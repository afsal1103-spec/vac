import {
  AmbientLight,
  Clock,
  DirectionalLight,
  Mesh,
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  WebGLRenderer
} from 'three';

export type AvatarEmotion = 'idle' | 'thinking' | 'happy' | 'surprised' | 'speaking';

export type AvatarEngineOptions = {
  canvas: HTMLCanvasElement;
  transparent?: boolean;
  pixelRatio?: number;
};

export type AvatarProfile = {
  avatarGlbUrl: string;
  displayName: string;
  personalityPreset: string;
};

export type VisemeFrame = {
  time: number;
  viseme: string;
  value: number;
};

export type LipSyncTrack = {
  durationMs: number;
  frames: VisemeFrame[];
};

export const DEFAULT_VISEME_MAP: Record<string, string> = {
  PP: 'viseme_PP',
  FF: 'viseme_FF',
  TH: 'viseme_TH',
  DD: 'viseme_DD',
  KK: 'viseme_kk',
  CH: 'viseme_CH',
  SS: 'viseme_SS',
  NN: 'viseme_nn',
  RR: 'viseme_RR',
  AA: 'viseme_aa',
  E: 'viseme_E',
  IH: 'viseme_I',
  OH: 'viseme_O',
  OU: 'viseme_U'
};

export class AvatarEngine {
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera | OrthographicCamera;
  readonly renderer: WebGLRenderer;
  private clock = new Clock();
  private rafId: number | null = null;
  private activeEmotion: AvatarEmotion = 'idle';
  private avatarMesh: Mesh | null = null;
  private activeTrack: LipSyncTrack | null = null;

  constructor(private readonly options: AvatarEngineOptions) {
    const { canvas, transparent = true } = options;

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: transparent,
      preserveDrawingBuffer: false
    });

    this.renderer.setPixelRatio(options.pixelRatio ?? window.devicePixelRatio);

    this.camera = new PerspectiveCamera(38, 1, 0.1, 500);
    this.camera.position.set(0, 1.6, 2.6);

    const keyLight = new DirectionalLight('#ffffff', 1.15);
    keyLight.position.set(3, 4, 2);
    this.scene.add(keyLight);

    const fillLight = new AmbientLight('#a7d9ff', 0.55);
    this.scene.add(fillLight);
  }

  start() {
    if (this.rafId !== null) return;

    const frame = () => {
      this.tick();
      this.renderer.render(this.scene, this.camera);
      this.rafId = window.requestAnimationFrame(frame);
    };

    this.rafId = window.requestAnimationFrame(frame);
  }

  stop() {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  dispose() {
    this.stop();
    this.renderer.dispose();
  }

  resize(width: number, height: number) {
    this.renderer.setSize(width, height, false);
    if ('aspect' in this.camera) {
      this.camera.aspect = width / Math.max(height, 1);
      this.camera.updateProjectionMatrix();
    }
  }

  async loadAvatar(profile: AvatarProfile) {
    const module = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const loader = new module.GLTFLoader();

    const gltf = await loader.loadAsync(profile.avatarGlbUrl);

    if (this.avatarMesh) {
      this.scene.remove(this.avatarMesh);
    }

    const root = gltf.scene;
    root.position.set(0, 0, 0);
    this.scene.add(root);

    this.avatarMesh = root.children.find((child) => child instanceof Mesh) as Mesh | null;
  }

  setEmotion(emotion: AvatarEmotion) {
    this.activeEmotion = emotion;
  }

  setLipSyncTrack(track: LipSyncTrack | null) {
    this.activeTrack = track;
    this.clock.elapsedTime = 0;
  }

  private tick() {
    const elapsedMs = this.clock.getElapsedTime() * 1000;
    if (!this.activeTrack) return;

    let frame: VisemeFrame | undefined;
    for (let i = this.activeTrack.frames.length - 1; i >= 0; i -= 1) {
      const candidate = this.activeTrack.frames[i];
      if (candidate.time <= elapsedMs) {
        frame = candidate;
        break;
      }
    }
    if (!frame) return;

    this.applyViseme(frame.viseme, frame.value);

    if (elapsedMs >= this.activeTrack.durationMs) {
      this.activeTrack = null;
      this.applyViseme('PP', 0);
    }
  }

  private applyViseme(viseme: string, value: number) {
    if (!this.avatarMesh?.morphTargetDictionary || !this.avatarMesh.morphTargetInfluences) return;

    const targetName = DEFAULT_VISEME_MAP[viseme] ?? DEFAULT_VISEME_MAP.PP;
    const index = this.avatarMesh.morphTargetDictionary[targetName];

    if (typeof index === 'number') {
      this.avatarMesh.morphTargetInfluences[index] = value;
    }
  }
}
