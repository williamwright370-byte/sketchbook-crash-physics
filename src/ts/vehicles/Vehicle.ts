import { Character } from '../characters/Character';
import * as THREE from 'three';
import * as CANNON from 'cannon';
import { World } from '../world/World';
import _ = require('lodash');
import { KeyBinding } from '../core/KeyBinding';
import { VehicleSeat } from './VehicleSeat';
import { Wheel } from './Wheel';
import { VehicleDoor } from './VehicleDoor';
import * as Utils from '../core/FunctionLibrary';
import { CollisionGroups } from '../enums/CollisionGroups';
import { SwitchingSeats } from '../characters/character_states/vehicles/SwitchingSeats';
import { EntityType } from '../enums/EntityType';
import { IWorldEntity } from '../interfaces/IWorldEntity';

export abstract class Vehicle extends THREE.Object3D implements IWorldEntity
{
	public updateOrder: number = 2;
	public abstract entityType: EntityType;
	
	public controllingCharacter: Character;
	public actions: { [action: string]: KeyBinding; } = {};
	public rayCastVehicle: CANNON.RaycastVehicle;
	public seats: VehicleSeat[] = [];
	public wheels: Wheel[] = [];
	public drive: string;
	public camera: any;
	public world: World;
	public help: THREE.AxesHelper;
	public collision: CANNON.Body;
	public materials: THREE.Material[] = [];
	public spawnPoint: THREE.Object3D;
	private modelContainer: THREE.Group;

	// Soft-body crash deformation: per-axis squash amount driven by collision
	// impulses and sprung back to zero (underdamped, so vehicles wobble
	// like jelly after a crash). Applied to the visual model only.
	private deformVec: THREE.Vector3 = new THREE.Vector3();
	private deformVel: THREE.Vector3 = new THREE.Vector3();
	private deformAccel: THREE.Vector3 = new THREE.Vector3();

	// Crash behavior toggles (wired to the settings GUI in World.ts).
	// Squash: the temporary jelly wobble. Damage: permanent dents that
	// accumulate with every hard impact and never spring back.
	public static crashSquashEnabled: boolean = true;
	public static crashDamageEnabled: boolean = false;

	// Permanent crash damage: accumulated per-axis dent (0..0.55) plus a
	// small random body tilt per impact, so a wrecked vehicle stays wrecked.
	private damageVec: THREE.Vector3 = new THREE.Vector3();
	private damageTilt: THREE.Euler = new THREE.Euler();

	private firstPerson: boolean = false;

	constructor(gltf: any, handlingSetup?: any)
	{
		super();

		if (handlingSetup === undefined) handlingSetup = {};
		handlingSetup.chassisConnectionPointLocal = new CANNON.Vec3(),
		handlingSetup.axleLocal = new CANNON.Vec3(-1, 0, 0);
		handlingSetup.directionLocal = new CANNON.Vec3(0, -1, 0);

		// Physics mat
		let mat = new CANNON.Material('Mat');
		mat.friction = 0.01;

		// Collision body
		this.collision = new CANNON.Body({ mass: 50 });
		this.collision.material = mat;

		// Read GLTF
		this.readVehicleData(gltf);

		this.modelContainer = new THREE.Group();
		this.add(this.modelContainer);
		this.modelContainer.add(gltf.scene);
		// this.setModel(gltf.scene);

		// Raycast vehicle component
		this.rayCastVehicle = new CANNON.RaycastVehicle({
			chassisBody: this.collision,
			indexUpAxis: 1,
			indexRightAxis: 0,
			indexForwardAxis: 2
		});

		this.wheels.forEach((wheel) =>
		{
			handlingSetup.chassisConnectionPointLocal.set(wheel.position.x, wheel.position.y + 0.2, wheel.position.z);
			const index = this.rayCastVehicle.addWheel(handlingSetup);
			wheel.rayCastWheelInfoIndex = index;
		});

		this.help = new THREE.AxesHelper(2);

		// Crash deformation: hard impacts kick the deform spring and/or add
		// permanent damage, depending on the enabled toggles.
		this.collision.addEventListener('collide', (event: any) =>
		{
			const impact = Math.abs(event.contact.getImpactVelocityAlongNormal());
			if (impact < 2.5) return;

			// Impact normal in vehicle-local space (sign doesn't matter, the
			// squash is symmetric per axis)
			const ni = event.contact.ni;
			const localN = new THREE.Vector3(ni.x, ni.y, ni.z)
				.applyQuaternion(this.quaternion.clone().inverse());

			const strength = Math.min(0.08 * impact, 0.45);

			if (Vehicle.crashSquashEnabled)
			{
				const kick = strength * 10;
				this.deformVel.x += Math.abs(localN.x) * kick;
				this.deformVel.y += Math.abs(localN.y) * kick;
				this.deformVel.z += Math.abs(localN.z) * kick;
			}

			if (Vehicle.crashDamageEnabled)
			{
				// Permanent dent along the impact axis (capped so the model
				// never fully flattens), plus a small random body tilt.
				this.damageVec.x = Math.min(this.damageVec.x + Math.abs(localN.x) * strength * 0.6, 0.55);
				this.damageVec.y = Math.min(this.damageVec.y + Math.abs(localN.y) * strength * 0.6, 0.55);
				this.damageVec.z = Math.min(this.damageVec.z + Math.abs(localN.z) * strength * 0.6, 0.55);
				this.damageTilt.x += (Math.random() - 0.5) * strength * 0.15;
				this.damageTilt.z += (Math.random() - 0.5) * strength * 0.15;
				this.damageTilt.x = THREE.MathUtils.clamp(this.damageTilt.x, -0.09, 0.09);
				this.damageTilt.z = THREE.MathUtils.clamp(this.damageTilt.z, -0.09, 0.09);
			}
		});
	}

	/**
	 * Integrates the crash-deformation spring and applies the resulting
	 * squash (with a slight perpendicular bulge) to the vehicle model,
	 * combined with any permanent accumulated crash damage.
	 */
	private updateDeformation(timeStep: number): void
	{
		const hasDamage = this.damageVec.lengthSq() > 1e-6 || this.damageTilt.x !== 0 || this.damageTilt.z !== 0;
		const springActive = this.deformVec.lengthSq() >= 1e-6 || this.deformVel.lengthSq() >= 1e-6;
		if (!hasDamage && !springActive) return;

		if (springActive)
		{
			// Underdamped spring: bouncy wobble back to rest
			const stiffness = 90;
			const damping = 5;
			this.deformAccel.copy(this.deformVec).multiplyScalar(-stiffness)
				.addScaledVector(this.deformVel, -damping);
			this.deformVel.addScaledVector(this.deformAccel, timeStep);
			this.deformVec.addScaledVector(this.deformVel, timeStep);
		}

		// Temporary spring squash + permanent dents on the same axes
		const d = this.deformVec;
		d.x = THREE.MathUtils.clamp(d.x, -0.2, 0.5);
		d.y = THREE.MathUtils.clamp(d.y, -0.2, 0.5);
		d.z = THREE.MathUtils.clamp(d.z, -0.2, 0.5);
		const sx = d.x + this.damageVec.x;
		const sy = d.y + this.damageVec.y;
		const sz = d.z + this.damageVec.z;

		const bulge = 0.3;
		this.modelContainer.scale.set(
			THREE.MathUtils.clamp(1 - sx + bulge * (sy + sz), 0.45, 1.4),
			THREE.MathUtils.clamp(1 - sy + bulge * (sx + sz), 0.45, 1.4),
			THREE.MathUtils.clamp(1 - sz + bulge * (sx + sy), 0.45, 1.4)
		);
		this.modelContainer.rotation.set(this.damageTilt.x, 0, this.damageTilt.z);
	}

	public noDirectionPressed(): boolean
	{
		return true;
	}

	public update(timeStep: number): void
	{
		this.position.set(
			this.collision.interpolatedPosition.x,
			this.collision.interpolatedPosition.y,
			this.collision.interpolatedPosition.z
		);

		this.quaternion.set(
			this.collision.interpolatedQuaternion.x,
			this.collision.interpolatedQuaternion.y,
			this.collision.interpolatedQuaternion.z,
			this.collision.interpolatedQuaternion.w
		);

		this.seats.forEach((seat: VehicleSeat) => {
			seat.update(timeStep);
		});

		this.updateDeformation(timeStep);

		for (let i = 0; i < this.rayCastVehicle.wheelInfos.length; i++)
		{
			this.rayCastVehicle.updateWheelTransform(i);
			let transform = this.rayCastVehicle.wheelInfos[i].worldTransform;

			let wheelObject = this.wheels[i].wheelObject;
			wheelObject.position.copy(Utils.threeVector(transform.position));
			wheelObject.quaternion.copy(Utils.threeQuat(transform.quaternion));

			let upAxisWorld = new CANNON.Vec3();
			this.rayCastVehicle.getVehicleAxisWorld(this.rayCastVehicle.indexUpAxis, upAxisWorld);
		}

		this.updateMatrixWorld();
	}

	public forceCharacterOut(): void
	{
		this.controllingCharacter.modelContainer.visible = true;
		this.controllingCharacter.exitVehicle();
	}

	public onInputChange(): void
	{
		if (this.actions.seat_switch.justPressed && this.controllingCharacter?.occupyingSeat?.connectedSeats.length > 0)
		{
			this.controllingCharacter.modelContainer.visible = true;
			this.controllingCharacter.setState(
				new SwitchingSeats(
					this.controllingCharacter,
					this.controllingCharacter.occupyingSeat,
					this.controllingCharacter.occupyingSeat.connectedSeats[0]
				)
			);
			this.controllingCharacter.stopControllingVehicle();
		}
	}

	public resetControls(): void
	{
		for (const action in this.actions) {
			if (this.actions.hasOwnProperty(action)) {
				this.triggerAction(action, false);
			}
		}
	}

	public allowSleep(value: boolean): void
	{
		this.collision.allowSleep = value;

		if (value === false)
		{
			this.collision.wakeUp();
		}
	}

	public handleKeyboardEvent(event: KeyboardEvent, code: string, pressed: boolean): void
	{
		// Free camera
		if (code === 'KeyC' && pressed === true && event.shiftKey === true)
		{
			this.resetControls();
			this.world.cameraOperator.characterCaller = this.controllingCharacter;
			this.world.inputManager.setInputReceiver(this.world.cameraOperator);
		}
		else if (code === 'KeyR' && pressed === true && event.shiftKey === true)
		{
			this.world.restartScenario();
		}
		else
		{
			for (const action in this.actions) {
				if (this.actions.hasOwnProperty(action)) {
					const binding = this.actions[action];

					if (_.includes(binding.eventCodes, code))
					{
						this.triggerAction(action, pressed);
					}
				}
			}
		}
	}

	public setFirstPersonView(value: boolean): void
	{
		this.firstPerson = value;
		if (this.controllingCharacter !== undefined) this.controllingCharacter.modelContainer.visible = !value;

		if (value)
		{
			this.world.cameraOperator.setRadius(0, true);
		}
		else
		{
			this.world.cameraOperator.setRadius(3, true);
		}
	}

	public toggleFirstPersonView(): void
	{
		this.setFirstPersonView(!this.firstPerson);
	}
	
	public triggerAction(actionName: string, value: boolean): void
	{
		// Get action and set it's parameters
		let action = this.actions[actionName];

		if (action.isPressed !== value)
		{
			// Set value
			action.isPressed = value;

			// Reset the 'just' attributes
			action.justPressed = false;
			action.justReleased = false;

			// Set the 'just' attributes
			if (value) action.justPressed = true;
			else action.justReleased = true;

			this.onInputChange();

			// Reset the 'just' attributes
			action.justPressed = false;
			action.justReleased = false;
		}
	}

	public handleMouseButton(event: MouseEvent, code: string, pressed: boolean): void
	{
		return;
	}

	public handleMouseMove(event: MouseEvent, deltaX: number, deltaY: number): void
	{
		this.world.cameraOperator.move(deltaX, deltaY);
	}

	public handleMouseWheel(event: WheelEvent, value: number): void
	{
		this.world.scrollTheTimeScale(value);
	}

	public inputReceiverInit(): void
	{
		this.collision.allowSleep = false;
		this.setFirstPersonView(false);
	}

	public inputReceiverUpdate(timeStep: number): void
	{
		if (this.firstPerson)
		{
			// this.world.cameraOperator.target.set(
			//     this.position.x + this.camera.position.x,
			//     this.position.y + this.camera.position.y,
			//     this.position.z + this.camera.position.z
			// );

			let temp = new THREE.Vector3().copy(this.camera.position);
			temp.applyQuaternion(this.quaternion);
			this.world.cameraOperator.target.copy(temp.add(this.position));
		}
		else
		{
			// Position camera
			this.world.cameraOperator.target.set(
				this.position.x,
				this.position.y + 0.5,
				this.position.z
			);
		}
	}

	public setPosition(x: number, y: number, z: number): void
	{
		this.collision.position.x = x;
		this.collision.position.y = y;
		this.collision.position.z = z;
	}

	public setSteeringValue(val: number): void
	{
		this.wheels.forEach((wheel) =>
		{
			if (wheel.steering) this.rayCastVehicle.setSteeringValue(val, wheel.rayCastWheelInfoIndex);
		});
	}

	public applyEngineForce(force: number): void
	{
		this.wheels.forEach((wheel) =>
		{
			if (this.drive === wheel.drive || this.drive === 'awd')
			{
				this.rayCastVehicle.applyEngineForce(force, wheel.rayCastWheelInfoIndex);
			}
		});
	}

	public setBrake(brakeForce: number, driveFilter?: string): void
	{
		this.wheels.forEach((wheel) =>
		{
			if (driveFilter === undefined || driveFilter === wheel.drive)
			{
				this.rayCastVehicle.setBrake(brakeForce, wheel.rayCastWheelInfoIndex);
			}
		});
	}

	public addToWorld(world: World): void
	{
		if (_.includes(world.vehicles, this))
		{
			console.warn('Adding character to a world in which it already exists.');
		}
		else if (this.rayCastVehicle === undefined)
		{
			console.error('Trying to create vehicle without raycastVehicleComponent');
		}
		else
		{
			this.world = world;
			world.vehicles.push(this);
			world.graphicsWorld.add(this);
			// world.physicsWorld.addBody(this.collision);
			this.rayCastVehicle.addToWorld(world.physicsWorld);

			this.wheels.forEach((wheel) =>
			{
				world.graphicsWorld.attach(wheel.wheelObject);
			});

			this.materials.forEach((mat) =>
			{
				world.sky.csm.setupMaterial(mat);
			});
		}
	}

	public removeFromWorld(world: World): void
	{
		if (!_.includes(world.vehicles, this))
		{
			console.warn('Removing character from a world in which it isn\'t present.');
		}
		else
		{
			this.world = undefined;
			_.pull(world.vehicles, this);
			world.graphicsWorld.remove(this);
			// world.physicsWorld.remove(this.collision);
			this.rayCastVehicle.removeFromWorld(world.physicsWorld);

			this.wheels.forEach((wheel) =>
			{
				world.graphicsWorld.remove(wheel.wheelObject);
			});
		}
	}

	public readVehicleData(gltf: any): void
	{
		gltf.scene.traverse((child) => {

			if (child.isMesh)
			{
				Utils.setupMeshProperties(child);

				if (child.material !== undefined)
				{
					this.materials.push(child.material);
				}
			}

			if (child.hasOwnProperty('userData'))
			{
				if (child.userData.hasOwnProperty('data'))
				{
					if (child.userData.data === 'seat')
					{
						this.seats.push(new VehicleSeat(this, child, gltf));
					}
					if (child.userData.data === 'camera')
					{
						this.camera = child;
					}
					if (child.userData.data === 'wheel')
					{
						this.wheels.push(new Wheel(child));
					}
					if (child.userData.data === 'collision')
					{
						if (child.userData.shape === 'box')
						{
							child.visible = false;

							let phys = new CANNON.Box(new CANNON.Vec3(child.scale.x, child.scale.y, child.scale.z));
							phys.collisionFilterMask = ~CollisionGroups.TrimeshColliders;
							this.collision.addShape(phys, new CANNON.Vec3(child.position.x, child.position.y, child.position.z));
						}
						else if (child.userData.shape === 'sphere')
						{
							child.visible = false;

							let phys = new CANNON.Sphere(child.scale.x);
							phys.collisionFilterGroup = CollisionGroups.TrimeshColliders;
							this.collision.addShape(phys, new CANNON.Vec3(child.position.x, child.position.y, child.position.z));
						}
					}
					if (child.userData.data === 'navmesh')
					{
						child.visible = false;
					}
				}
			}
		});

		if (this.collision.shapes.length === 0)
		{
			console.warn('Vehicle ' + typeof(this) + ' has no collision data.');
		}
		if (this.seats.length === 0)
		{
			console.warn('Vehicle ' + typeof(this) + ' has no seats.');
		}
		else
		{
			this.connectSeats();
		}
	}

	private connectSeats(): void
	{
		for (const firstSeat of this.seats)
		{
			if (firstSeat.connectedSeatsString !== undefined)
			{
				// Get list of connected seat names
				let conn_seat_names = firstSeat.connectedSeatsString.split(';');
				for (const conn_seat_name of conn_seat_names)
				{
					// If name not empty
					if (conn_seat_name.length > 0)
					{
						// Run through seat list and connect seats to this seat,
						// based on this seat's connected seats list
						for (const secondSeat of this.seats)
						{
							if (secondSeat.seatPointObject.name === conn_seat_name) 
							{
								firstSeat.connectedSeats.push(secondSeat);
							}
						}
					}
				}
			}
		}
	}
}