import * as THREE from 'three'

import { withQuality } from './texture-quality'

export interface WoodTextures {
  diffuse: THREE.Texture
  normal: THREE.Texture
  roughness: THREE.Texture
  reflection: THREE.Texture
}

export function loadWoodTextures(loader: THREE.TextureLoader): WoodTextures {
  const base = '/texture/bookshelf/737-Bois-de-Sienne-Siena-Wood-001-'
  return {
    diffuse: withQuality(loader.load(`${base}DIFFUSE-4K.png`)),
    normal: withQuality(loader.load(`${base}NORMALS8_OPENGL-4K.png`)),
    roughness: withQuality(loader.load(`${base}ROUGHNESS-4K.png`)),
    reflection: withQuality(loader.load(`${base}REFLECTION-4K.png`)),
  }
}

export function makeWoodMat(
  texs: WoodTextures,
  repeatU: number,
  repeatV: number,
  roughnessMult = 1,
  rotate = false,
): THREE.MeshStandardMaterial {
  const c = (t: THREE.Texture): THREE.Texture => {
    const cl = t.clone()
    cl.wrapS = cl.wrapT = THREE.RepeatWrapping
    cl.repeat.set(repeatU, repeatV)
    if (rotate) {
      cl.rotation = Math.PI / 2
      cl.center.set(0.5, 0.5)
    }
    cl.needsUpdate = true
    return withQuality(cl)
  }
  return new THREE.MeshStandardMaterial({
    map: c(texs.diffuse),
    normalMap: c(texs.normal),
    roughnessMap: c(texs.roughness),
    metalnessMap: c(texs.reflection),
    roughness: roughnessMult,
    metalness: 0.05,
  })
}
