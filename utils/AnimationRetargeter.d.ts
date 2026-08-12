import * as THREE from 'three';
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
export declare class AnimationRetargeter {
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
    static retarget(sourceScene: THREE.Object3D, clips: THREE.AnimationClip[], targetRoot: THREE.Object3D, heightRatio: number, fps?: number): THREE.AnimationClip[] | null;
    /**
     * Match boxman bones against the target skeleton by normalized name.
     * Returns null unless at least hips + one arm + one leg are mapped.
     */
    private static buildBoneMap;
}
