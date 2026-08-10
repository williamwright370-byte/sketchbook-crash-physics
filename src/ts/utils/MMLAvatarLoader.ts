import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { SkeletonUtils } from 'three/examples/jsm/utils/SkeletonUtils';

export interface MMLAvatar
{
	scene: THREE.Object3D;
	animations: THREE.AnimationClip[];
}

interface MMLCharacterData
{
	bodySrc: string;
	traits: { type: string; src: string }[];
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
export class MMLAvatarLoader
{
	private loader: GLTFLoader;
	private dracoLoader: DRACOLoader;

	constructor()
	{
		this.dracoLoader = new DRACOLoader();
		this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');

		this.loader = new GLTFLoader();
		this.loader.setDRACOLoader(this.dracoLoader);
	}

	public async loadFromUrl(url: string): Promise<MMLAvatar>
	{
		if (/\.(mml|html?)(\?.*)?$/i.test(url))
		{
			const characterData = await this.extractCharacterData(url);
			return this.loadCharacterWithTraits(characterData);
		}
		else
		{
			// Direct model URL
			const gltf = await this.loadGLTFWithRetry(url);
			const scene = this.prepareScene(gltf);
			return { scene, animations: gltf.animations || [] };
		}
	}

	/**
	 * Parse an MML/HTML document and pull out the m-character body source
	 * plus any m-model trait sources. Relative URLs are resolved against
	 * the document URL.
	 */
	private async extractCharacterData(url: string): Promise<MMLCharacterData>
	{
		const response = await fetch(url);
		if (!response.ok)
		{
			throw new Error(`Failed to fetch MML document (${response.status}): ${url}`);
		}

		const text = await response.text();
		const doc = new DOMParser().parseFromString(text, 'text/html');
		const character = doc.querySelector('m-character');

		if (!character)
		{
			throw new Error('No <m-character> element found in MML document');
		}

		const bodySrc = character.getAttribute('src');
		if (!bodySrc)
		{
			throw new Error('<m-character> has no src attribute');
		}

		const traits = Array.from(character.querySelectorAll('m-model')).map((model) => ({
			type: model.getAttribute('type') || '',
			src: model.getAttribute('src') || '',
		})).filter((trait) => trait.src.length > 0);

		return {
			bodySrc: new URL(bodySrc, url).toString(),
			traits: traits.map((trait) => ({
				type: trait.type,
				src: new URL(trait.src, url).toString(),
			})),
		};
	}

	/**
	 * Load the body model and merge all trait models into it as siblings.
	 * Traits that fail to load are skipped so a single bad trait can't
	 * kill the whole avatar.
	 */
	private async loadCharacterWithTraits(characterData: MMLCharacterData): Promise<MMLAvatar>
	{
		const bodyGltf = await this.loadGLTFWithRetry(characterData.bodySrc);
		const scene = this.prepareScene(bodyGltf);
		const animations: THREE.AnimationClip[] = (bodyGltf.animations || []).slice();

		const traitGltfs = await Promise.all(
			characterData.traits.map((trait) =>
				this.loadGLTFWithRetry(trait.src).catch((error) =>
				{
					console.error(`Failed to load MML trait: ${trait.src}`, error);
					return null;
				})
			)
		);

		traitGltfs.forEach((gltf) =>
		{
			if (gltf !== null)
			{
				scene.add(this.prepareScene(gltf));
				(gltf.animations || []).forEach((clip) => animations.push(clip));
			}
		});

		return { scene, animations };
	}

	private prepareScene(gltf: GLTF): THREE.Object3D
	{
		const scene = SkeletonUtils.clone(gltf.scene) as THREE.Object3D;

		scene.traverse((child) =>
		{
			if ((child as THREE.Mesh).isMesh)
			{
				child.castShadow = true;
				child.receiveShadow = true;
			}
		});

		return scene;
	}

	private async loadGLTFWithRetry(url: string, retries: number = 2): Promise<GLTF>
	{
		try
		{
			return await this.loadGLTF(url);
		}
		catch (error)
		{
			if (retries > 0)
			{
				console.warn(`Retrying model load (${retries} left): ${url}`);
				await new Promise((resolve) => setTimeout(resolve, 1000));
				return this.loadGLTFWithRetry(url, retries - 1);
			}
			throw error;
		}
	}

	private loadGLTF(url: string): Promise<GLTF>
	{
		return new Promise((resolve, reject) =>
		{
			this.loader.load(url, (gltf) => resolve(gltf), undefined, (error) => reject(error));
		});
	}

	public dispose(): void
	{
		this.dracoLoader.dispose();
	}
}
