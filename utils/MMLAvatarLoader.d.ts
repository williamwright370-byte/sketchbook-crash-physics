import * as THREE from 'three';
export interface MMLAvatar {
    scene: THREE.Object3D;
    animations: THREE.AnimationClip[];
}
/**
 * Loads MML (Metaverse Markup Language) avatars into plain THREE objects.
 *
 * Accepts:
 *  - .mml / .html documents containing an <m-character src="body.glb">
 *    element with optional <m-model src="trait.glb"> children
 *  - direct .glb / .gltf model URLs
 *
 * The returned group can be attached to a Character's modelContainer and
 * any animation clips found in the GLBs are returned alongside it.
 */
export declare class MMLAvatarLoader {
    private loader;
    private dracoLoader;
    constructor();
    loadFromUrl(url: string): Promise<MMLAvatar>;
    /**
     * Parse an MML/HTML document and pull out the m-character body source
     * plus any m-model trait sources. Relative URLs are resolved against
     * the document URL.
     */
    private extractCharacterData;
    /**
     * Load the body model and merge all trait models into it as siblings.
     * Traits that fail to load are skipped so a single bad trait can't
     * kill the whole avatar.
     */
    private loadCharacterWithTraits;
    private prepareScene;
    private loadGLTFWithRetry;
    private loadGLTF;
    dispose(): void;
}
