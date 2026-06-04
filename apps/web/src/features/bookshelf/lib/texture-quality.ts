import * as THREE from 'three'

// 모듈 전역: ThreeCanvas 마운트 시 renderer capability로 1회 세팅
let maxAnisotropy = 1

export function setMaxAnisotropy(value: number): void {
  maxAnisotropy = value
}

export function withQuality<T extends THREE.Texture>(tex: T): T {
  tex.anisotropy = maxAnisotropy
  return tex
}
