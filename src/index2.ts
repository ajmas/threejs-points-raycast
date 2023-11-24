// using version 0.157.0 of ThreeJS
import { AdditiveBlending, ArrowHelper, BufferGeometry, Camera, Color, Float32BufferAttribute, Mesh, MeshBasicMaterial, PerspectiveCamera, Points, PointsMaterial, Raycaster, Scene, ShaderMaterial, SphereGeometry, Vector2, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import allPointCoords from './AllPoints';

// This version makes use of ShaderMaterial for the points

class Viewer {
  scene?: Scene;
  camera?: PerspectiveCamera;
  controls?: OrbitControls;
  renderer?: WebGLRenderer;
  raycaster?: Raycaster;
  canvas?: HTMLCanvasElement;
  raycastArrow?: ArrowHelper;
  colors: number[] = [];
  points?: Points;


  initPlanet (scene: Scene) {
    const material = new MeshBasicMaterial({
      color: 0x3322ff,
      depthTest: true,
      transparent: false
    });

    const radius = 2;
    const geometry = new SphereGeometry(radius, 32, 32);
    const sphere = new Mesh( geometry, material );

    scene.add(sphere);
  }


  initPointCloud (scene: Scene) {
    const geometry = new BufferGeometry();
    const vertices: Float32Array = new Float32Array(allPointCoords as number[]);
    const sizes: Float32Array = new Float32Array();

    const pointCount = allPointCoords.length / 3;

    this.colors = Array.from({ length: pointCount * 3 });
    vertices.fill(0, 0, pointCount);
    this.colors.fill(1, 0, pointCount * 3);
    sizes.fill(10, 0, pointCount);

    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(this.colors, 3));
    geometry.setAttribute('size', new Float32BufferAttribute(sizes, 1));

    const vertexShader = ' \
    attribute float size; \
    attribute vec4 color; \
    \
    varying vec4 vColor; \
    \
    void main() { \
      vec4 position = projectionMatrix * modelViewMatrix * vec4(position,1.); \
      gl_PointSize = min(max(320000.0 / position.w, 7.5), 20.0) * 1.0; \
      gl_Position = position; \
      vColor = color; \
    } \
    ';

    const fragmentShader = ' \
    uniform vec3 color; \
    uniform sampler2D pointTexture; \
    \
    varying vec4 vColor; \
    void main() { \
      vec2 ptCoord = gl_PointCoord * 2.0 - vec2(1.0, 1.0); \
      float r = 1.0 - min(abs(length(ptCoord)), 1.0); \
      float alpha = pow(r + 0.1, 3.0);  \
      alpha = min(alpha, 1.0);  \
      \
      gl_FragColor = vec4(vColor.rgb, vColor.a * alpha); \
    } \
    ';

    const material = new ShaderMaterial ({
      uniforms: {
        color: { value: new Color( 0xffffff ) },
        // pointTexture: { value: texture }
      },
      clipping: true,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      blending: AdditiveBlending,
      depthTest: true,
      transparent: true
    });

    this.points = new Points( geometry, material );
    scene.add(this.points);
  }

  updatePointColours (rayIntersects: Record<string, any>[]) {
    if (!this.points) {
      return;
    }

    const pointCount = allPointCoords.length / 3;
    this.colors.fill(1, 0, pointCount * 3);

    for (let i = 0; i < rayIntersects.length; i++) {
      if (rayIntersects[i].object === this.points) {
        const idx = rayIntersects[i].index * 3;
        this.colors[idx] = 1;
        this.colors[idx + 1] = 0;
        this.colors[idx + 2] = 0;
      }
    }

    const geometry = this.points.geometry;
    geometry.setAttribute('color', new Float32BufferAttribute(this.colors, 3));

  }

  onClick (event: MouseEvent) {
    if (!this.raycaster || !this.scene || !this.camera || !this.canvas) {
      return;
    }

    // adjust this to control the number of point candidates
    this.raycaster.params.Points.threshold = 0.1;

    const bounds = this.canvas.getBoundingClientRect();
    const mouse: Vector2 = new Vector2();
    mouse.x = (((event.clientX - bounds.left) / this.canvas.clientWidth) * 2) - 1;
    mouse.y = -(((event.clientY - bounds.top) / this.canvas.clientHeight) * 2) + 1;

    this.raycaster.setFromCamera( mouse, this.camera);

    // if (this.raycastArrow) {
    //   this.scene.remove(this.raycastArrow);
    //   this.raycastArrow.dispose();
    //   this.raycastArrow = undefined;
    // }
    // this.raycastArrow = new ArrowHelper(this.raycaster.ray.direction, this.raycaster.ray.origin, 300, 0xffff00, undefined, 1) ;
    // this.scene.add(this.raycastArrow);

    const intersects = this.raycaster.intersectObjects(this.scene.children, true);

    if (intersects.length > 0) {
      console.log('>>>', intersects);
      this.updatePointColours(intersects);
    }
  }

  init () {
    this.scene = new Scene();
    this.camera = new PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 1000 );

    this.renderer = new WebGLRenderer({ antialias: false });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document
      .querySelector('.viewer')
      ?.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.zoomSpeed = 0.1;
    this.camera.position.set( 15, 0, -100 );
    this.controls.update();


    this.camera.position.y = 5;
    this.camera.zoom = 5;

    this.raycaster = new Raycaster();

    this.camera.position.y = 42;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 100;
    this.controls.enablePan = false;
    this.controls.enableDamping = true;

    this.camera.updateProjectionMatrix();

    this.initPointCloud(this.scene);
    this.initPlanet(this.scene);

    this.canvas = this.renderer.domElement;
    if (this.canvas) {
      this.canvas.addEventListener('click', this.onClick.bind(this));
    }
  }

  animate () {
    requestAnimationFrame(this.animate.bind(this));

    if (this.controls) {
      this.controls.update();
    }

    if (this.renderer) {
      this.renderer.render(this.scene as Scene, this.camera as Camera);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const viewer = new Viewer();
  viewer.init();
  viewer.animate();
});