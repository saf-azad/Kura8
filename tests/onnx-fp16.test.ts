import { it, expect } from 'vitest';
// @ts-expect-error plain ESM build script without type declarations
import { float16Bits, floatsToHalf, toFloat16Model, pruneOutputs } from '../scripts/onnx-fp16.mjs';
import onnxProto from 'onnx-proto';
const { onnx } = onnxProto;
const bits = (v: number) => new Uint16Array(new Float16Array([v]).buffer)[0];
it('rounds float32 to float16 bits exactly like the platform conversion', () => {
  for (const v of [0, -0, 1, -1, 0.1, 65504, 65520, 1e-8, 6e-8, 5.960464477539063e-8, 3.14159, -2.5e-5, 1024.5, 2049, 2051, Infinity, -Infinity]) expect(float16Bits(v)).toBe(bits(v));
  expect(float16Bits(NaN) & 0x7c00).toBe(0x7c00);
});
it('clamps tiny and huge magnitudes before converting', () => {
  const half = floatsToHalf(Float32Array.from([1e-9, -1e-9, 5e4, -5e4, 2, 0]));
  expect(Array.from(half)).toEqual([bits(1e-7), bits(-1e-7), bits(1e4), bits(-1e4), bits(2), 0]);
});
function tinyModel() {
  const T = onnx.TensorProto, D = T.DataType, A = onnx.AttributeProto.AttributeType;
  const tensorType = (elemType: number) => ({ tensorType: { elemType, shape: { dim: [{ dimValue: 1 }, { dimValue: 1 }, { dimValue: 2 }, { dimValue: 2 }] } } });
  const w = T.create({ name: 'w', dataType: D.FLOAT, dims: [1, 1, 1, 1], rawData: new Uint8Array(new Float32Array([2]).buffer) });
  const sizes = T.create({ name: 'sizes', dataType: D.INT64, dims: [4], rawData: new Uint8Array(new BigInt64Array([1n, 1n, 4n, 4n]).buffer) });
  const graph = onnx.GraphProto.create({
    name: 'tiny', input: [{ name: 'x', type: tensorType(D.FLOAT) }], output: [{ name: 'y', type: tensorType(D.FLOAT) }, { name: 'side', type: tensorType(D.FLOAT) }],
    initializer: [w, sizes],
    node: [
      onnx.NodeProto.create({ opType: 'Conv', name: 'conv', input: ['x', 'w'], output: ['c'] }),
      onnx.NodeProto.create({ opType: 'Resize', name: 'resize', input: ['c', '', '', 'sizes'], output: ['r'], attribute: [onnx.AttributeProto.create({ name: 'mode', type: A.STRING, s: new TextEncoder().encode('nearest') })] }),
      onnx.NodeProto.create({ opType: 'Sigmoid', name: 'sig', input: ['r'], output: ['y'] }),
      onnx.NodeProto.create({ opType: 'Relu', name: 'side', input: ['c'], output: ['side'] }),
    ],
  });
  return onnx.ModelProto.create({ irVersion: 7, opsetImport: [{ domain: '', version: 13 }], graph });
}
it('prunes to the kept outputs and fences blocked ops with casts while keeping the interface float32', () => {
  const src = onnx.ModelProto.encode(tinyModel()).finish();
  const out = onnx.ModelProto.decode(toFloat16Model(src, { keepOutputs: ['y'] })), g = out.graph;
  expect(g.output.map(o => o.name)).toEqual(['y']);
  expect(g.node.map(n => `${n.opType}:${n.input.join(',')}->${n.output.join(',')}`)).toEqual([
    'Cast:x->x_fp16', 'Conv:x_fp16,w->c', 'Cast:c->c_fp32', 'Resize:c_fp32,,,sizes->r_fp32', 'Cast:r_fp32->r', 'Sigmoid:r->y_fp16', 'Cast:y_fp16->y',
  ]);
  expect(g.initializer.find(t => t.name === 'w')?.dataType).toBe(onnx.TensorProto.DataType.FLOAT16);
  expect(g.initializer.find(t => t.name === 'sizes')?.dataType).toBe(onnx.TensorProto.DataType.INT64);
  expect(g.input[0].type?.tensorType?.elemType).toBe(onnx.TensorProto.DataType.FLOAT);
  expect(g.output[0].type?.tensorType?.elemType).toBe(onnx.TensorProto.DataType.FLOAT);
  const casts = g.node.filter(n => n.opType === 'Cast').map(n => Number(n.attribute[0].i));
  expect(casts).toEqual([10, 1, 10, 1]);
});
it('keeps an initializer float32 when only a blocked op reads it', () => {
  const m = tinyModel();
  m.graph.node[1].input[2] = 'scales'; m.graph.node[1].input[3] = '';
  m.graph.initializer.push(onnx.TensorProto.create({ name: 'scales', dataType: onnx.TensorProto.DataType.FLOAT, dims: [4], rawData: new Uint8Array(new Float32Array([1, 1, 2, 2]).buffer) }));
  const g = onnx.ModelProto.decode(toFloat16Model(onnx.ModelProto.encode(m).finish(), { keepOutputs: ['y'] })).graph;
  expect(g.initializer.find(t => t.name === 'scales')?.dataType).toBe(onnx.TensorProto.DataType.FLOAT);
  expect(g.node.find(n => n.opType === 'Resize')?.input).toEqual(['c_fp32', '', 'scales', '']);
});
it('pruneOutputs drops unreachable nodes and initializers', () => {
  const g = tinyModel().graph; pruneOutputs(g, ['side']);
  expect(g.node.map(n => n.name)).toEqual(['conv', 'side']); expect(g.initializer.map(t => t.name)).toEqual(['w']);
});
