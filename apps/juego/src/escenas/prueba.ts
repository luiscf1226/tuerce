// Escena de prueba de la base del juego: unas cajas caen sobre un tronco con Rapier a 60 pasos por segundo.
// Sirve para las capturas automáticas y para ver que físicas y dibujo van juntos.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import type { Rapier } from "../motor/fisica";
import { COLORES } from "./colores";
import type { Escena } from "./tipos";

interface Cuerpo {
  cuerpo: RAPIER.RigidBody;
  malla: THREE.Mesh;
  antes: { p: THREE.Vector3; q: THREE.Quaternion };
  ahora: { p: THREE.Vector3; q: THREE.Quaternion };
}

export function crearEscenaPrueba(rapier: Rapier, mundo: RAPIER.World): Escena {
  const escena = new THREE.Scene();
  escena.background = new THREE.Color(COLORES.niebla);
  escena.fog = new THREE.Fog(COLORES.niebla, 8, 30);

  const camara = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 100);
  camara.position.set(0, 3.2, 12);
  camara.lookAt(0, 1.6, 0);

  escena.add(new THREE.HemisphereLight(0xffffff, 0x8a8a86, 2.2));
  const sol = new THREE.DirectionalLight(0xffffff, 1.4);
  sol.position.set(-4, 10, 6);
  escena.add(sol);

  const silueta = new THREE.MeshStandardMaterial({ color: COLORES.silueta, roughness: 1 });

  // El tronco caído que hace de suelo
  const suelo = new THREE.Mesh(
    new THREE.BoxGeometry(14, 0.6, 3),
    new THREE.MeshStandardMaterial({ color: COLORES.suelo, roughness: 1 }),
  );
  suelo.position.y = -0.3;
  escena.add(suelo);
  mundo.createCollider(rapier.ColliderDesc.cuboid(7, 0.3, 1.5).setTranslation(0, -0.3, 0));

  // Troncos de pino al fondo, cada vez más tragados por la niebla
  for (let i = 0; i < 9; i++) {
    const z = -3 - (i % 3) * 5;
    const tronco = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.35, 16, 8),
      new THREE.MeshStandardMaterial({ color: i % 3 === 0 ? COLORES.silueta : COLORES.siluetaLejana, roughness: 1 }),
    );
    tronco.position.set(-9 + i * 2.3, 6, z);
    escena.add(tronco);
  }

  const cuerpos: Cuerpo[] = [];
  const caja = (x: number, y: number, lado: number, color?: number) => {
    const material = color === undefined ? silueta : new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    const malla = new THREE.Mesh(new THREE.BoxGeometry(lado, lado, lado), material);
    escena.add(malla);
    const cuerpo = mundo.createRigidBody(
      rapier.RigidBodyDesc.dynamic()
        .setTranslation(x, y, 0)
        .setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3 * x, 0, 0.2 * y))),
    );
    mundo.createCollider(
      rapier.ColliderDesc.cuboid(lado / 2, lado / 2, lado / 2)
        .setRestitution(0.1)
        .setFriction(0.8),
      cuerpo,
    );
    const p = new THREE.Vector3().copy(cuerpo.translation());
    const q = new THREE.Quaternion().copy(cuerpo.rotation());
    cuerpos.push({ cuerpo, malla, antes: { p: p.clone(), q: q.clone() }, ahora: { p, q } });
  };
  caja(-2.5, 2, 1);
  caja(-2.2, 4, 0.8);
  caja(0, 3, 1.2);
  caja(0.3, 6, 0.6, COLORES.panueloRojo);
  caja(2.4, 2.5, 0.9);
  caja(2.6, 5, 0.6, COLORES.panueloTurquesa);

  return {
    nombre: "prueba",
    escena,
    camara,
    pasar() {
      mundo.step();
      for (const c of cuerpos) {
        c.antes.p.copy(c.ahora.p);
        c.antes.q.copy(c.ahora.q);
        c.ahora.p.copy(c.cuerpo.translation());
        c.ahora.q.copy(c.cuerpo.rotation());
      }
    },
    dibujar(alfa) {
      for (const c of cuerpos) {
        c.malla.position.lerpVectors(c.antes.p, c.ahora.p, alfa);
        c.malla.quaternion.slerpQuaternions(c.antes.q, c.ahora.q, alfa);
      }
    },
  };
}
