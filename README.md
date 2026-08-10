<p align="center">
	<a href="https://jblaha.art/sketchbook/latest"><img src="./src/img/thumbnail.png"></a>
	<br>
	<a href="https://jblaha.art/sketchbook/latest">Live demo</a>
	<br>
</p>

# Final update (20. Feb 2023)

As I have no more interest in developing this project, it comes to a conclusion. In order to remain honest about the true state of the project, I am archiving this repository.

- If you wish to modify Sketchbook feel free to fork it.
- To see if someone is currently maintaining a fork, check out the [Network Graph](https://github.com/swift502/Sketchbook/network).

# 📒 Sketchbook

Simple web based game engine built on [three.js](https://github.com/mrdoob/three.js) and [cannon.js](https://github.com/schteppe/cannon.js) focused on third-person character controls and related gameplay mechanics.

Mostly a playground for exploring how conventional third person gameplay mechanics found in modern games work and recreating them in a general way.

## Features

* World
	* Three.js scene
	* Cannon.js physics
	* Variable timescale
	* Frame skipping
	* FXAA anti-aliasing
* Characters
	* Third-person camera
	* Raycast character controller with capsule collisions
	* General state system
	* Character AI
* Vehicles
	* Cars
	* Airplanes
	* Helicopters

All planned features can be found in the [GitHub Projects](https://github.com/swift502/Sketchbook/projects).

## Usage

You can define your own scenes in Blender, and then read them with Sketchbook. Sketchbook needs to run on a local server such as [http-server](https://www.npmjs.com/package/http-server) or [webpack-dev-server](https://github.com/webpack/webpack-dev-server) to be able to load external assets.

<!-- #### Script tag -->

1. Import:

```html
<script src="sketchbook.min.js"></script>
```

2. Load a glb scene defined in Blender:

```javascript
const world = new Sketchbook.World('scene.glb');
```

<!--

#### NPM

1. Install:

```
npm i sketchbook
```

2. Import:

```javascript
import { World } from 'sketchbook';
```

3. Load a glb scene defined in Blender:

```javascript
const world = new World('scene.glb');
```

-->

## MML Avatars

Sketchbook can dress characters in [MML (Metaverse Markup Language)](https://mmleditor.com/) avatars instead of the default boxman model.

Three ways to enable it:

1. **Query parameter** — append `?mml=<url>` to the page URL, e.g.
   `http://localhost:8080/?mml=https://files.directivecreator.com/grillz/mml/1.mml`
2. **Settings GUI** — paste a URL into the *Default MML URL* field (applies to characters spawned after the change, e.g. via a scenario relaunch).
3. **Scene data** — set a `mml_url` property on a `player` spawn object in the world scene.

Accepted URL formats: `.mml` / `.html` documents containing an `<m-character>` element (with `<m-model>` trait children), or a direct `.glb` / `.gltf` model URL. Relative trait URLs inside MML documents are resolved against the document URL. If loading fails the character keeps the default model. Physics, movement and the state machine are unaffected — only the visual model, materials and animation mixer are swapped.

## Contributing

1. Get the LTS version of [Node.js](https://nodejs.org/en/) 16
2. [Fork this repository](https://help.github.com/en/github/getting-started-with-github/fork-a-repo)
3. Run `npm install`
4. Run `npm run dev`
5. Make changes and test them out at http://localhost:8080
6. Commit and [make a pull request](https://help.github.com/en/github/collaborating-with-issues-and-pull-requests/creating-a-pull-request-from-a-fork)!

## Credits

Big thank you to each of the following github users for contributing to Sketchbook:

- [aleqsunder](https://github.com/aleqsunder)
- [barhatsor](https://github.com/barhatsor)
- [danshuri](https://github.com/danshuri)
