import * as THREE from 'three';
import * as CANNON from 'cannon';
import { KeyBinding } from '../core/KeyBinding';
import { VectorSpringSimulator } from '../physics/spring_simulation/VectorSpringSimulator';
import { RelativeSpringSimulator } from '../physics/spring_simulation/RelativeSpringSimulator';
import { ICharacterAI } from '../interfaces/ICharacterAI';
import { World } from '../world/World';
import { IControllable } from '../interfaces/IControllable';
import { ICharacterState } from '../interfaces/ICharacterState';
import { IWorldEntity } from '../interfaces/IWorldEntity';
import { VehicleSeat } from '../vehicles/VehicleSeat';
import { Vehicle } from '../vehicles/Vehicle';
import { CapsuleCollider } from '../physics/colliders/CapsuleCollider';
import { VehicleEntryInstance } from './VehicleEntryInstance';
import { GroundImpactData } from './GroundImpactData';
import { EntityType } from '../enums/EntityType';
export declare class Character extends THREE.Object3D implements IWorldEntity {
    updateOrder: number;
    entityType: EntityType;
    height: number;
    tiltContainer: THREE.Group;
    modelContainer: THREE.Group;
    materials: THREE.Material[];
    mixer: THREE.AnimationMixer;
    animations: any[];
    mmlUrl: string;
    private currentClipName;
    private mmlLoader;
    private boxmanRestScene;
    private boxmanClips;
    acceleration: THREE.Vector3;
    velocity: THREE.Vector3;
    arcadeVelocityInfluence: THREE.Vector3;
    velocityTarget: THREE.Vector3;
    arcadeVelocityIsAdditive: boolean;
    defaultVelocitySimulatorDamping: number;
    defaultVelocitySimulatorMass: number;
    velocitySimulator: VectorSpringSimulator;
    moveSpeed: number;
    angularVelocity: number;
    orientation: THREE.Vector3;
    orientationTarget: THREE.Vector3;
    defaultRotationSimulatorDamping: number;
    defaultRotationSimulatorMass: number;
    rotationSimulator: RelativeSpringSimulator;
    viewVector: THREE.Vector3;
    actions: {
        [action: string]: KeyBinding;
    };
    characterCapsule: CapsuleCollider;
    rayResult: CANNON.RaycastResult;
    rayHasHit: boolean;
    rayCastLength: number;
    raySafeOffset: number;
    wantsToJump: boolean;
    initJumpSpeed: number;
    groundImpactData: GroundImpactData;
    raycastBox: THREE.Mesh;
    world: World;
    charState: ICharacterState;
    behaviour: ICharacterAI;
    controlledObject: IControllable;
    occupyingSeat: VehicleSeat;
    vehicleEntryInstance: VehicleEntryInstance;
    private physicsEnabled;
    constructor(gltf: any, mmlUrl?: string);
    /**
     * Load an MML avatar and replace the default model with it.
     * Movement, physics and state logic are untouched - only the visual
     * model, materials, mixer and animation clips are swapped.
     *
     * The avatar is scaled to the default character's height and grounded
     * at the same foot level. The boxman animation clips are retargeted
     * onto the avatar's skeleton so the state machine (idle, run, jump,
     * sitting, driving, ...) fully animates the rig even when the MML
     * model ships no clips of its own.
     */
    private loadMMLAvatar;
    /**
     * Min/max Y of a model in its current pose, computing skinned vertex
     * positions on the CPU. Regular bounding boxes ignore skinning and
     * report the wrong size for skinned meshes (e.g. double-counting an
     * armature scale), so this is the reliable way to measure a rig.
     */
    private measureSkinnedBounds;
    private measureSkinnedHeight;
    setAnimations(animations: []): void;
    setArcadeVelocityInfluence(x: number, y?: number, z?: number): void;
    setViewVector(vector: THREE.Vector3): void;
    /**
     * Set state to the player. Pass state class (function) name.
     * @param {function} State
     */
    setState(state: ICharacterState): void;
    setPosition(x: number, y: number, z: number): void;
    resetVelocity(): void;
    setArcadeVelocityTarget(velZ: number, velX?: number, velY?: number): void;
    setOrientation(vector: THREE.Vector3, instantly?: boolean): void;
    resetOrientation(): void;
    setBehaviour(behaviour: ICharacterAI): void;
    setPhysicsEnabled(value: boolean): void;
    readCharacterData(gltf: any): void;
    handleKeyboardEvent(event: KeyboardEvent, code: string, pressed: boolean): void;
    handleMouseButton(event: MouseEvent, code: string, pressed: boolean): void;
    handleMouseMove(event: MouseEvent, deltaX: number, deltaY: number): void;
    handleMouseWheel(event: WheelEvent, value: number): void;
    triggerAction(actionName: string, value: boolean): void;
    takeControl(): void;
    resetControls(): void;
    update(timeStep: number): void;
    inputReceiverInit(): void;
    displayControls(): void;
    inputReceiverUpdate(timeStep: number): void;
    setAnimation(clipName: string, fadeIn: number): number;
    springMovement(timeStep: number): void;
    springRotation(timeStep: number): void;
    getLocalMovementDirection(): THREE.Vector3;
    getCameraRelativeMovementVector(): THREE.Vector3;
    setCameraRelativeOrientationTarget(): void;
    rotateModel(): void;
    jump(initJumpSpeed?: number): void;
    findVehicleToEnter(wantsToDrive: boolean): void;
    enterVehicle(seat: VehicleSeat, entryPoint: THREE.Object3D): void;
    teleportToVehicle(vehicle: Vehicle, seat: VehicleSeat): void;
    startControllingVehicle(vehicle: IControllable, seat: VehicleSeat): void;
    transferControls(entity: IControllable): void;
    stopControllingVehicle(): void;
    exitVehicle(): void;
    occupySeat(seat: VehicleSeat): void;
    leaveSeat(): void;
    physicsPreStep(body: CANNON.Body, character: Character): void;
    feetRaycast(): void;
    physicsPostStep(body: CANNON.Body, character: Character): void;
    addToWorld(world: World): void;
    removeFromWorld(world: World): void;
}
