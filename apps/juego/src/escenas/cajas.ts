// Cajas sueltas que se pueden empujar, agarrar y cargar: un cuerpo libre de Rapier y su malla, que se dibuja
// interpolando entre el paso anterior y el actual. Las usan las escenas `agarre` y `dos`.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import type { Rapier } from "../motor/fisica";

export interface Cajas {
  /** Suma una caja de `lado` metros y `masa` kilos con su centro en (x, y, z), girada `giro` radianes en y. */
  poner(x: number, y: number, z: number, lado: number, masa: number, giro?: number): RAPIER.RigidBody;
  /** Anota dónde estaba cada caja. Va antes de `mundo.step()`. */
  guardar(): void;
  /** Mueve las mallas entre el paso anterior y el actual (`alfa` de 0 a 1). */
  dibujar(alfa: number): void;
}

export function crearCajas(rapier: Rapier, mundo: RAPIER.World, escena: THREE.Scene, material: THREE.Material): Cajas {
  const lista: { cuerpo: RAPIER.RigidBody; malla: THREE.Mesh; antes: THREE.Vector3; antesQ: THREE.Quaternion }[] = [];
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const eje = new THREE.Vector3(0, 1, 0);
  return {
    poner(x, y, z, lado, masa, giro = 0) {
      const cuerpo = mundo.createRigidBody(
        rapier.RigidBodyDesc.dynamic().setTranslation(x, y, z).setRotation(q.setFromAxisAngle(eje, giro).clone()),
      );
      mundo.createCollider(
        rapier.ColliderDesc.cuboid(lado / 2, lado / 2, lado / 2)
          .setMass(masa)
          .setFriction(0.7),
        cuerpo,
      );
      const malla = new THREE.Mesh(new THREE.BoxGeometry(lado, lado, lado), material);
      malla.position.set(x, y, z);
      malla.quaternion.setFromAxisAngle(eje, giro);
      escena.add(malla);
      lista.push({ cuerpo, malla, antes: new THREE.Vector3(x, y, z), antesQ: malla.quaternion.clone() });
      return cuerpo;
    },
    guardar() {
      for (const c of lista) {
        c.antes.copy(c.cuerpo.translation());
        c.antesQ.copy(c.cuerpo.rotation());
      }
    },
    dibujar(alfa) {
      for (const c of lista) {
        c.malla.position.lerpVectors(c.antes, p.copy(c.cuerpo.translation()), alfa);
        c.malla.quaternion.slerpQuaternions(c.antesQ, q.copy(c.cuerpo.rotation()), alfa);
      }
    },
  };
}
