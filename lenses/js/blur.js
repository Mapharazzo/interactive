// Renders layers through an eye: each layer is convolved with the image of
// the pupil on the retina (an ellipse given by a 2×2 matrix) and composited
// back to front. Uses WebGL2; falls back to a plain Gaussian blur in 2D.

const SAMPLES = 96;

const VERT = `#version 300 es
in vec2 p;
out vec2 uv;
void main() {
  uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D tex;
uniform mat2 kernel;   // unit disk -> pixel offset
uniform vec2 size;
uniform float lod;
in vec2 uv;
out vec4 color;
void main() {
  vec4 acc = vec4(0.0);
  for (int i = 0; i < ${SAMPLES}; i++) {
    float f = float(i) + 0.5;
    float r = sqrt(f / ${SAMPLES}.0);
    float a = f * 2.39996323; // golden angle: an even spiral over the disk
    vec2 off = kernel * (r * vec2(cos(a), sin(a)));
    acc += textureLod(tex, uv + off / size, lod);
  }
  color = acc / ${SAMPLES}.0;
}`;

export function createRenderer(canvas) {
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false });
  return gl ? glRenderer(canvas, gl) : fallbackRenderer(canvas);
}

function glRenderer(canvas, gl) {
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = (n) => gl.getUniformLocation(prog, n);
  const uKernel = u("kernel"), uSize = u("size"), uLod = u("lod");
  gl.uniform1i(u("tex"), 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied "over"
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

  const textures = new Map();
  function texture(src) {
    let t = textures.get(src);
    if (t) return t;
    t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    textures.set(src, t);
    return t;
  }

  return {
    webgl: true,
    // layers: [{ canvas, kernel: [k00, k01, k10, k11] }], back to front
    render(layers) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uSize, canvas.width, canvas.height);
      for (const { canvas: src, kernel } of layers) {
        gl.bindTexture(gl.TEXTURE_2D, texture(src));
        // GLSL mat2 is column-major.
        gl.uniformMatrix2fv(uKernel, false, [kernel[0], kernel[2], kernel[1], kernel[3]]);
        // With a big kernel the samples are far apart; read from a smaller
        // mip level so the gaps between them are filled in.
        const extent = Math.max(Math.hypot(kernel[0], kernel[2]), Math.hypot(kernel[1], kernel[3]));
        gl.uniform1f(uLod, Math.max(0, Math.log2((extent * 2.2) / Math.sqrt(SAMPLES))));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    },
    forget(src) {
      const t = textures.get(src);
      if (t) gl.deleteTexture(t);
      textures.delete(src);
    },
  };
}

function fallbackRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  return {
    webgl: false,
    render(layers) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (const { canvas: src, kernel } of layers) {
        const r = Math.sqrt((kernel[0] ** 2 + kernel[1] ** 2 + kernel[2] ** 2 + kernel[3] ** 2) / 2);
        ctx.filter = `blur(${(r / 2).toFixed(1)}px)`;
        ctx.drawImage(src, 0, 0);
      }
      ctx.filter = "none";
    },
    forget() {},
  };
}
