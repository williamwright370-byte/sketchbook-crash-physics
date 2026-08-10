import * as THREE from 'three';
import { SkeletonUtils } from 'three/examples/jsm/utils/SkeletonUtils';

interface BoneSlot
{
	/** Slot key, used for cross-slot direction references. */
	key: string;
	/** Exact bone name in the source (boxman) skeleton. */
	source: string;
	/** Candidate bone names in the target skeleton, normalized (lowercase, alphanumerics only). */
	targets: string[];
	/**
	 * How to align rest poses. 'dir' computes a rotation that aligns the
	 * target bone's rest direction with the source bone's rest direction
	 * (needed when the rigs' rest poses differ, e.g. T-pose vs arms-down).
	 * 'none' assumes both rigs agree on the bone's rest orientation
	 * (spine/head of upright rigs).
	 */
	align: 'dir' | 'none';
	/** Slot key of the bone to measure this bone's direction toward. */
	dirTo?: string;
}

/**
 * Humanoid bone slots. Source names are the fixed Sketchbook boxman rig,
 * target candidates cover UE5-style names (pelvis, thigh_l) and common
 * Mixamo/VRM-style names (hips, leftupleg) after normalization.
 */
interface BoneSlot
{
	/** Slot key, used for cross-slot direction references. */
	key: string;
	/** Exact bone name in the source (boxman) skeleton. */
	source: string;
	/** Candidate bone names in the target skeleton, normalized (lowercase, alphanumerics only). */
	targets: string[];
	/**
	 * How to align rest poses. 'dir' computes a rotation that aligns the
	 * target bone's rest direction with the source bone's rest direction
	 * (needed when the rigs' rest poses differ, e.g. T-pose vs arms-down).
	 * 'none' assumes both rigs agree on the bone's rest orientation
	 * (spine/head of upright rigs).
	 */
	align: 'dir' | 'none';
	/** Slot key of the bone to measure this bone's direction toward. */
	dirTo?: string;
}

/**
 * Humanoid bone slots. Source names are the fixed Sketchbook boxman rig,
 * target candidates cover UE5-style names (pelvis, thigh_l) and common
 * Mixamo/VRM-style names (hips, leftupleg) after normalization.
 */
const BONE_SLOTS: BoneSlot[] = [
	{ key: 'hips',       source: 'butt_bone',  targets: ['pelvis', 'hips', 'hip'],                                    align: 'none' },
	{ key: 'spineLower', source: 'body_lower', targets: ['spine01', 'spine1', 'spine', 'spine02'],                    align: 'none' },
	{ key: 'spineUpper', source: 'body_upper', targets: ['spine03', 'spine2', 'chest', 'upperchest', 'spine05'],      align: 'none' },
	{ key: 'head',       source: 'head',       targets: ['head'],                                                     align: 'none' },
	{ key: 'upperArmL',  source: 'arm_upperL', targets: ['upperarml', 'leftarm', 'leftupperarm', 'shoulderl'],        align: 'dir', dirTo: 'lowerArmL' },
	{ key: 'lowerArmL',  source: 'arm_lowerL', targets: ['lowerarml', 'forearml', 'leftforearm', 'leftlowerarm'],     align: 'dir' },
	{ key: 'upperArmR',  source: 'arm_upperR', targets: ['upperarmr', 'rightarm', 'rightupperarm', 'shoulderr'],      align: 'dir', dirTo: 'lowerArmR' },
	{ key: 'lowerArmR',  source: 'arm_lowerR', targets: ['lowerarmr', 'forearmr', 'rightforearm', 'rightlowerarm'],   align: 'dir' },
	{ key: 'upperLegL',  source: 'leg_upperL', targets: ['thighl', 'leftupleg', 'leftupperleg', 'uplegl'],            align: 'dir', dirTo: 'lowerLegL' },
	{ key: 'lowerLegL',  source: 'leg_lowerL', targets: ['calfl', 'leftleg', 'leftlowerleg', 'shinl', 'lowerlegl'],   align: 'dir' },
	{ key: 'upperLegR',  source: 'leg_upperR', targets: ['thighr', 'rightupleg', 'rightupperleg', 'uplegr'],          align: 'dir', dirTo: 'lowerLegR' },
	{ key: 'lowerLegR',  source: 'leg_lowerR', targets: ['calfr', 'rightleg', 'rightlowerleg', 'shinr', 'lowerlegr'], align: 'dir' },
];

interface BonePair
{
	slot: BoneSlot;
	sourceBone: THREE.Object3D;
	targetBone: THREE.Object3D;
	isHips: boolean;
}

interface BonePair
{
	sourceBone: THREE.Object3D;
	targetBone: THREE.Object3D;
	isHips: boolean;
}

function normalizeName(name: string): string
{
	return name.toLowerCase().replace(/mixamorig/g, '').replace(/[^a-z0-9]/g, '');
}

/**
 * Retargets animation clips from the Sketchbook boxman rig onto an
 * arbitrary humanoid skeleton (e.g. an MML avatar with a UE5 rig).
 *
 * The source clips only animate a 12-bone humanoid subset; the retarget
 * maps those bones by name and samples each clip, transferring world-space
 * rotation deltas (rest pose -> posed) from source bones onto the target
 * skeleton. Hip translation is transferred scaled by the height ratio.
 * Unmapped target bones stay at their rest pose.
 */
export class AnimationRetargeter
{
	/**
	 * Returns retargeted clips (same names/durations as the source clips),
	 * or null if the target skeleton doesn't look humanoid enough to map.
	 *
	 * @param sourceScene pristine (rest-pose) boxman scene the clips target
	 * @param clips       boxman animation clips
	 * @param targetRoot  MML avatar scene, in bind/rest pose
	 * @param heightRatio target height / source height, scales hip translation
	 * @param fps         sampling rate
	 */
	public static retarget(
		sourceScene: THREE.Object3D,
		clips: THREE.AnimationClip[],
		targetRoot: THREE.Object3D,
		heightRatio: number,
		fps: number = 30
	): THREE.AnimationClip[] | null
	{
		const pairs = this.buildBoneMap(sourceScene, targetRoot);
		if (pairs === null)
		{
			console.warn('AnimationRetargeter: could not map boxman bones onto target skeleton');
			return null;
		}
		console.log(`AnimationRetargeter: mapped ${pairs.length} bones`);

		// Work on a private clone so sampling never touches the live model
		const srcRoot = SkeletonUtils.clone(sourceScene) as THREE.Object3D;
		srcRoot.updateMatrixWorld(true);
		targetRoot.updateMatrixWorld(true);

		// Re-find the source bones on the clone
		const cloneLookup: { [name: string]: THREE.Object3D } = {};
		srcRoot.traverse((node) => { cloneLookup[node.name] = node; });
		const srcPairs = pairs.map((pair) => ({
			slot: pair.slot,
			sourceBone: cloneLookup[pair.sourceBone.name],
			targetBone: pair.targetBone,
			isHips: pair.isHips,
		}));

		// Rest-pose snapshot of the target hierarchy (pre-order: parents first)
		interface RestNode
		{
			node: THREE.Object3D;
			restPos: THREE.Vector3;
			restQuat: THREE.Quaternion;
			restScale: THREE.Vector3;
			restWorldPos: THREE.Vector3;
			restWorldQuat: THREE.Quaternion;
		}
		const restNodes: RestNode[] = [];
		targetRoot.traverse((node) =>
		{
			restNodes.push({
				node,
				restPos: node.position.clone(),
				restQuat: node.quaternion.clone(),
				restScale: node.scale.clone(),
				restWorldPos: new THREE.Vector3().setFromMatrixPosition(node.matrixWorld),
				restWorldQuat: new THREE.Quaternion().setFromRotationMatrix(
					new THREE.Matrix4().extractRotation(node.matrixWorld)
				),
			});
		});

		// Rest-pose snapshot of the mapped source bones
		const srcRest = srcPairs.map((pair) => ({
			worldPos: new THREE.Vector3().setFromMatrixPosition(pair.sourceBone.matrixWorld),
			worldQuat: new THREE.Quaternion().setFromRotationMatrix(
				new THREE.Matrix4().extractRotation(pair.sourceBone.matrixWorld)
			),
		}));
		const pairByNode = new Map<THREE.Object3D, number>();
		srcPairs.forEach((pair, i) => pairByNode.set(pair.targetBone, i));

		// Rest-pose direction alignment. The boxman rest pose has its arms
		// down while most MML avatars rest in T-pose, so limb bones get a
		// fixed alignment rotation that maps the target bone's rest
		// direction onto the source bone's rest direction.
		const worldPosOf = (obj: THREE.Object3D) => new THREE.Vector3().setFromMatrixPosition(obj.matrixWorld);
		const pairByKey = new Map<string, number>();
		srcPairs.forEach((pair, i) => pairByKey.set(pair.slot.key, i));

		const alignments = srcPairs.map((pair, i) =>
		{
			const slot = pair.slot;
			if (slot.align === 'none') return new THREE.Quaternion();

			const refIndex = slot.dirTo !== undefined ? pairByKey.get(slot.dirTo) : undefined;
			let srcDir: THREE.Vector3;
			let tgtDir: THREE.Vector3;
			if (refIndex !== undefined)
			{
				// Direction toward the referenced slot's bone (e.g. upper arm -> lower arm)
				srcDir = worldPosOf(srcPairs[refIndex].sourceBone).sub(srcRest[i].worldPos);
				tgtDir = worldPosOf(srcPairs[refIndex].targetBone).sub(worldPosOf(pair.targetBone));
			}
			else
			{
				// Leaf bone: reuse the limb direction (bone position - parent position)
				srcDir = srcRest[i].worldPos.sub(worldPosOf(pair.sourceBone.parent as THREE.Object3D));
				tgtDir = worldPosOf(pair.targetBone).sub(worldPosOf(pair.targetBone.parent as THREE.Object3D));
			}
			if (srcDir.length() < 1e-4 || tgtDir.length() < 1e-4) return new THREE.Quaternion();
			return new THREE.Quaternion().setFromUnitVectors(tgtDir.normalize(), srcDir.normalize());
		});

		const retargeted: THREE.AnimationClip[] = [];
		const mixer = new THREE.AnimationMixer(srcRoot);

		// Seated-state clips (car/plane/heli seats). Vehicle seat points are
		// authored for the boxman, whose hip bone sits near the TOP of its
		// boxy body, so a proportioned humanoid ends up seated too high even
		// with a faithful retarget. For these clips the pelvis gets an extra
		// vertical offset so the avatar's hip joints land exactly where the
		// boxman's hip joints are when seated. The same applies forward/back:
		// the boxman's torso is centered on its hips while a humanoid torso
		// leans forward of the pelvis, so the pelvis also gets a Z offset
		// that puts the avatar's seated head where the boxman's head is.
		const seatedClip = /sitting|driving|sit_down/;
		const thighPairs = srcPairs.filter((pair) =>
			pair.slot.key === 'upperLegL' || pair.slot.key === 'upperLegR');
		const headPair = srcPairs.find((pair) => pair.slot.key === 'head');

		for (const clip of clips)
		{
			const sampleCount = Math.max(2, Math.ceil(clip.duration * fps) + 1);
			const times: number[] = [];
			for (let i = 0; i < sampleCount; i++)
			{
				times.push(Math.min(i / fps, clip.duration));
			}

			const quatValues = new Map<THREE.Object3D, number[]>();
			const hipPosValues: number[] = [];
			srcPairs.forEach((pair) => quatValues.set(pair.targetBone, []));

			const action = mixer.clipAction(clip);
			action.setLoop(THREE.LoopOnce, 1);
			action.clampWhenFinished = true;
			action.play();

			// Per-frame scratch state
			const worldMats = new Map<THREE.Object3D, THREE.Matrix4>();
			const tmpMat = new THREE.Matrix4();
			const tmpQuat = new THREE.Quaternion();
			const tmpQuat2 = new THREE.Quaternion();
			const tmpVec = new THREE.Vector3();
			const parentQuat = new THREE.Quaternion();
			const parentScale = new THREE.Vector3();
			const prevQuats = new Map<THREE.Object3D, THREE.Quaternion>();

			// For seated clips, capture source and target hip-joint heights and
			// head forward positions at the mid frame so the pelvis can be
			// dropped onto the seat and shifted back (see seatedClip note above).
			const isSeated = seatedClip.test(clip.name) && thighPairs.length > 0;
			const midSample = Math.floor(sampleCount / 2);
			let srcSeatedThighY = 0;
			let tgtSeatedThighY = 0;
			let srcSeatedHeadZ = 0;
			let tgtSeatedHeadZ = 0;

			for (let s = 0; s < sampleCount; s++)
			{
				mixer.setTime(times[s]);
				srcRoot.updateMatrixWorld(true);
				worldMats.clear();

				for (const rest of restNodes)
				{
					const node = rest.node;
					// Parent world matrix: computed this frame, or static rest matrix
					// for anything above the target root / non-animated ancestors.
					const parentMat = worldMats.get(node.parent as THREE.Object3D) ||
						(node.parent ? node.parent.matrixWorld : tmpMat.identity());

					parentMat.decompose(tmpVec, parentQuat, parentScale);

					const pairIndex = pairByNode.get(node);
					let localQuat: THREE.Quaternion;
					let localPos: THREE.Vector3;

					if (pairIndex !== undefined)
					{
						// World-space rotation delta from source rest pose
						const pair = srcPairs[pairIndex];
						const srcWorldQuat = tmpQuat.setFromRotationMatrix(
							new THREE.Matrix4().extractRotation(pair.sourceBone.matrixWorld)
						);
						const delta = tmpQuat2.copy(srcRest[pairIndex].worldQuat).inverse().premultiply(srcWorldQuat);
						const desiredWorldQuat = delta.multiply(alignments[pairIndex]).multiply(rest.restWorldQuat);
						localQuat = parentQuat.clone().inverse().multiply(desiredWorldQuat);

						if (pair.isHips)
						{
							// Scaled world-space translation delta
							const srcWorldPos = new THREE.Vector3().setFromMatrixPosition(pair.sourceBone.matrixWorld);
							const desiredWorldPos = srcWorldPos.sub(srcRest[pairIndex].worldPos)
								.multiplyScalar(heightRatio).add(rest.restWorldPos);
							localPos = desiredWorldPos.applyMatrix4(tmpMat.getInverse(parentMat));
							hipPosValues.push(localPos.x, localPos.y, localPos.z);
						}
						else
						{
							localPos = rest.restPos.clone();
						}

						// Keep quaternion sign continuity for clean interpolation
						const prev = prevQuats.get(node);
						if (prev !== undefined && prev.dot(localQuat) < 0)
						{
							localQuat.set(-localQuat.x, -localQuat.y, -localQuat.z, -localQuat.w);
						}
						prevQuats.set(node, localQuat.clone());
						quatValues.get(node)!.push(localQuat.x, localQuat.y, localQuat.z, localQuat.w);
					}
					else
					{
						localQuat = rest.restQuat;
						localPos = rest.restPos;
					}

					worldMats.set(node, new THREE.Matrix4().compose(localPos, localQuat, rest.restScale).premultiply(parentMat));
				}

				if (isSeated && s === midSample)
				{
					for (const thigh of thighPairs)
					{
						srcSeatedThighY += new THREE.Vector3()
							.setFromMatrixPosition(thigh.sourceBone.matrixWorld).y / thighPairs.length;
						const tgtMat = worldMats.get(thigh.targetBone);
						if (tgtMat !== undefined)
						{
							tgtSeatedThighY += new THREE.Vector3()
								.setFromMatrixPosition(tgtMat).y / thighPairs.length;
						}
					}
					if (headPair !== undefined)
					{
						srcSeatedHeadZ = new THREE.Vector3()
							.setFromMatrixPosition(headPair.sourceBone.matrixWorld).z;
						const tgtHeadMat = worldMats.get(headPair.targetBone);
						if (tgtHeadMat !== undefined)
						{
							tgtSeatedHeadZ = new THREE.Vector3()
								.setFromMatrixPosition(tgtHeadMat).z;
						}
					}
				}
			}

			action.stop();
			mixer.uncacheClip(clip);

			const hipsPair = srcPairs.find((pair) => pair.isHips);
			if (isSeated && hipsPair !== undefined && hipPosValues.length > 0)
			{
				// Drop the pelvis so the avatar's seated hip joints match the
				// boxman's, and shift it back so the avatar's seated head lands
				// where the boxman's head is (a humanoid torso leans forward of
				// the pelvis while the boxman's is centered on its hips). The
				// offsets are computed in target world space and converted to
				// pelvis-local space via the pelvis parent's (static,
				// non-animated) rest world matrix.
				const seatOffset = srcSeatedThighY - tgtSeatedThighY;
				const backOffset = THREE.MathUtils.clamp(srcSeatedHeadZ - tgtSeatedHeadZ, -0.5, 0.5);
				const parentRot = new THREE.Matrix4().extractRotation(
					(hipsPair.targetBone.parent as THREE.Object3D).matrixWorld);
				const parentInv = new THREE.Matrix4().getInverse(parentRot);
				const localOffset = new THREE.Vector3(0, seatOffset, backOffset).applyMatrix4(parentInv);
				for (let i = 0; i < hipPosValues.length; i += 3)
				{
					hipPosValues[i] += localOffset.x;
					hipPosValues[i + 1] += localOffset.y;
					hipPosValues[i + 2] += localOffset.z;
				}
				console.log(`AnimationRetargeter: seated clip '${clip.name}' pelvis offset ${seatOffset.toFixed(3)}, back offset ${backOffset.toFixed(3)}`);
			}

			const tracks: THREE.KeyframeTrack[] = [];
			quatValues.forEach((values, bone) =>
			{
				tracks.push(new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, times.slice(), values));
			});
			if (hipsPair !== undefined && hipPosValues.length > 0)
			{
				tracks.push(new THREE.VectorKeyframeTrack(`${hipsPair.targetBone.name}.position`, times.slice(), hipPosValues));
			}

			retargeted.push(new THREE.AnimationClip(clip.name, clip.duration, tracks));
		}

		return retargeted;
	}

	/**
	 * Match boxman bones against the target skeleton by normalized name.
	 * Returns null unless at least hips + one arm + one leg are mapped.
	 */
	private static buildBoneMap(sourceScene: THREE.Object3D, targetRoot: THREE.Object3D): BonePair[] | null
	{
		const sourceBones: { [name: string]: THREE.Object3D } = {};
		sourceScene.traverse((node) => { sourceBones[node.name] = node; });

		const targetByNorm: { [norm: string]: THREE.Object3D } = {};
		targetRoot.traverse((node) =>
		{
			const norm = normalizeName(node.name);
			if (norm.length > 0 && targetByNorm[norm] === undefined)
			{
				targetByNorm[norm] = node;
			}
		});

		const pairs: BonePair[] = [];
		for (const slot of BONE_SLOTS)
		{
			const sourceBone = sourceBones[slot.source];
			if (sourceBone === undefined) continue;

			const targetName = slot.targets.find((name) => targetByNorm[name] !== undefined);
			if (targetName === undefined) continue;

			pairs.push({
				slot,
				sourceBone,
				targetBone: targetByNorm[targetName],
				isHips: slot.source === 'butt_bone',
			});
		}

		const hasHips = pairs.some((pair) => pair.isHips);
		const hasArm = pairs.some((pair) => pair.sourceBone.name.indexOf('arm') !== -1);
		const hasLeg = pairs.some((pair) => pair.sourceBone.name.indexOf('leg') !== -1);
		return (hasHips && hasArm && hasLeg) ? pairs : null;
	}
}
