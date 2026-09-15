// Float16 conversion of an ONNX model in Node, modelled on onnxconverter-common's convert_float_to_float16 with
// keep_io_types: weights and activations become float16, graph inputs and outputs stay float32, and ops without
// float16 kernels (Resize and friends) keep float32 inside a pair of Cast nodes. Used by prepare-model.mjs so the
// small weight variant is derived from the pinned upstream download instead of hosted separately.
import onnxProto from 'onnx-proto';
const { onnx } = onnxProto;
const { FLOAT, FLOAT16, INT64, BOOL } = onnx.TensorProto.DataType;
const ATTR = onnx.AttributeProto.AttributeType;
/** Ops kept in float32 (same default block list as onnxconverter-common). */
export const BLOCKED_OPS = new Set(['ArrayFeatureExtractor', 'Binarizer', 'CastMap', 'CategoryMapper', 'DictVectorizer', 'FeatureVectorizer', 'Imputer', 'LabelEncoder', 'LinearClassifier', 'LinearRegressor', 'Normalizer', 'OneHotEncoder', 'RandomUniformLike', 'SVMClassifier', 'SVMRegressor', 'Scaler', 'TreeEnsembleClassifier', 'TreeEnsembleRegressor', 'ZipMap', 'NonMaxSuppression', 'TopK', 'RoiAlign', 'Resize', 'Range', 'CumSum', 'Min', 'Max', 'Upsample']);
const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
/** IEEE round-to-nearest-even float32 → float16 bit pattern. */
export function float16Bits(value) {
  if (Number.isNaN(value)) return 0x7e00;
  f32[0] = value; const bits = u32[0], sign = (bits >>> 16) & 0x8000, exp = (bits >>> 23) & 0xff; let mant = bits & 0x7fffff;
  if (exp === 0xff) return sign | 0x7c00 | (mant ? 0x200 : 0);
  const e = exp - 112;
  if (e >= 0x1f) return sign | 0x7c00;
  if (e <= 0) {
    if (e < -10) return sign;
    mant |= 0x800000; const shift = 14 - e, half = mant >>> shift, rem = mant & ((1 << shift) - 1), halfway = 1 << (shift - 1);
    return sign | (rem > halfway || (rem === halfway && (half & 1)) ? half + 1 : half);
  }
  const half = sign | (e << 10) | (mant >>> 13), rem = mant & 0x1fff;
  return rem > 0x1000 || (rem === 0x1000 && (half & 1)) ? half + 1 : half;
}
/** Clamp tiny and huge magnitudes the way onnxconverter-common does, then convert. */
export function floatsToHalf(values, minPositive = 1e-7, maxFinite = 1e4) {
  const out = new Uint16Array(values.length);
  for (let i = 0; i < values.length; i++) {
    let v = values[i];
    if (v > 0 && v < minPositive) v = minPositive; else if (v < 0 && v > -minPositive) v = -minPositive;
    else if (v > maxFinite && v !== Infinity) v = maxFinite; else if (v < -maxFinite && v !== -Infinity) v = -maxFinite;
    out[i] = float16Bits(v);
  }
  return out;
}
function tensorFloats(t) {
  if (t.rawData?.length) return new Float32Array(t.rawData.buffer.slice(t.rawData.byteOffset, t.rawData.byteOffset + t.rawData.byteLength));
  return Float32Array.from(t.floatData ?? []);
}
function convertTensor(t) {
  const half = floatsToHalf(tensorFloats(t));
  t.dataType = FLOAT16; t.floatData = []; t.rawData = new Uint8Array(half.buffer, half.byteOffset, half.byteLength);
}
function cloneTensor(t) { return onnx.TensorProto.decode(onnx.TensorProto.encode(t).finish()); }
function castNode(input, output, to) { return onnx.NodeProto.create({ opType: 'Cast', name: `Cast_${output}`, input: [input], output: [output], attribute: [onnx.AttributeProto.create({ name: 'to', type: ATTR.INT, i: to })] }); }
/** Keep only the listed graph outputs and the nodes and initializers they depend on. */
export function pruneOutputs(graph, keep) {
  graph.output = graph.output.filter(o => keep.includes(o.name));
  if (graph.output.length !== keep.length) throw new Error(`Graph lacks outputs ${keep.filter(k => !graph.output.some(o => o.name === k)).join(', ')}`);
  const producer = new Map(); for (const n of graph.node) for (const o of n.output) producer.set(o, n);
  const live = new Set(), stack = graph.output.map(o => o.name), names = new Set();
  while (stack.length) { const name = stack.pop(); if (names.has(name)) continue; names.add(name); const n = producer.get(name); if (n && !live.has(n)) { live.add(n); stack.push(...n.input.filter(Boolean)); } }
  graph.node = graph.node.filter(n => live.has(n));
  graph.initializer = graph.initializer.filter(t => names.has(t.name));
  graph.valueInfo = [];
}
/** Infer each tensor's element type well enough to know which blocked-node inputs are float. */
function inferTypes(graph) {
  const types = new Map();
  for (const i of graph.input) types.set(i.name, i.type?.tensorType?.elemType ?? FLOAT);
  for (const t of graph.initializer) types.set(t.name, t.dataType);
  const first = n => { for (const i of n.input) if (types.has(i)) return types.get(i); return FLOAT; };
  for (const n of graph.node) {
    const attr = name => n.attribute.find(a => a.name === name);
    let type;
    switch (n.opType) {
      case 'Constant': { const a = n.attribute[0]; type = a.type === ATTR.TENSOR ? a.t.dataType : a.type === ATTR.FLOAT || a.type === ATTR.FLOATS ? FLOAT : INT64; break; }
      case 'ConstantOfShape': type = attr('value')?.t?.dataType ?? FLOAT; break;
      case 'Shape': case 'Size': case 'ArgMax': case 'ArgMin': case 'NonZero': type = INT64; break;
      case 'Cast': type = Number(attr('to').i); break;
      case 'Equal': case 'Greater': case 'GreaterOrEqual': case 'Less': case 'LessOrEqual': case 'Not': case 'And': case 'Or': case 'Xor': case 'IsNaN': case 'IsInf': type = BOOL; break;
      case 'Where': type = types.get(n.input[1]) ?? first(n); break;
      default: type = first(n);
    }
    n.output.forEach((o, i) => types.set(o, n.opType === 'TopK' && i === 1 ? INT64 : type));
  }
  return types;
}
/**
 * Convert a float32 ONNX model to float16 with float32 inputs and outputs.
 * @param {Uint8Array} bytes serialised ModelProto
 * @param {{ keepOutputs?: string[] }} options optionally keep only these graph outputs
 * @returns {Uint8Array} serialised float16 ModelProto
 */
export function toFloat16Model(bytes, { keepOutputs } = {}) {
  const model = onnx.ModelProto.decode(bytes), graph = model.graph;
  if (graph.node.some(n => n.attribute.some(a => a.type === ATTR.GRAPH || a.type === ATTR.GRAPHS))) throw new Error('Subgraphs are not supported');
  if (keepOutputs) pruneOutputs(graph, keepOutputs);
  graph.valueInfo = [];
  const types = inferTypes(graph);
  const blocked = new Set(graph.node.filter(n => BLOCKED_OPS.has(n.opType)));
  const consumers = new Map(); for (const n of graph.node) for (const i of n.input) if (i) (consumers.get(i) ?? consumers.set(i, []).get(i)).push(n);
  const rewire = (from, to, only) => { for (const n of consumers.get(from) ?? []) if (only(n)) n.input = n.input.map(i => i === from ? to : i); };
  const keptFloat32 = new Set(graph.input.map(i => i.name));
  // Initializers: float16 for unblocked consumers, float32 for blocked ones, a copy when both use them.
  for (const t of [...graph.initializer]) {
    if (t.dataType !== FLOAT) continue;
    const users = consumers.get(t.name) ?? [], blockedUsers = users.filter(n => blocked.has(n));
    if (blockedUsers.length === 0) convertTensor(t);
    else if (blockedUsers.length === users.length) keptFloat32.add(t.name);
    else { const copy = cloneTensor(t); copy.name = `${t.name}_fp16`; convertTensor(copy); graph.initializer.push(copy); types.set(copy.name, FLOAT16); rewire(t.name, copy.name, n => !blocked.has(n)); keptFloat32.add(t.name); }
  }
  const nodes = [];
  // Graph inputs feed unblocked nodes through a Cast to float16.
  for (const i of graph.input) {
    if (types.get(i.name) !== FLOAT || !(consumers.get(i.name) ?? []).some(n => !blocked.has(n))) continue;
    nodes.push(castNode(i.name, `${i.name}_fp16`, FLOAT16)); rewire(i.name, `${i.name}_fp16`, n => !blocked.has(n));
  }
  const outputs = new Set(graph.output.map(o => o.name)), casts32 = new Map();
  for (const n of graph.node) {
    if (blocked.has(n)) {
      for (const [k, name] of n.input.entries()) {
        if (!name || types.get(name) !== FLOAT || keptFloat32.has(name)) continue;
        if (!casts32.has(name)) { casts32.set(name, `${name}_fp32`); nodes.push(castNode(name, `${name}_fp32`, FLOAT)); }
        n.input[k] = casts32.get(name);
      }
      nodes.push(n);
      n.output = n.output.map(o => {
        if (!o || types.get(o) !== FLOAT || outputs.has(o)) { keptFloat32.add(o); return o; }
        nodes.push(castNode(`${o}_fp32`, o, FLOAT16)); return `${o}_fp32`;
      });
      continue;
    }
    // Unblocked: float tensor attributes become float16; a copy stays float32 for blocked consumers.
    for (const a of n.attribute) if (a.type === ATTR.TENSOR && a.t?.dataType === FLOAT) {
      const users = consumers.get(n.output[0]) ?? [], blockedUsers = users.filter(u => blocked.has(u));
      if (blockedUsers.length === users.length && users.length) { keptFloat32.add(n.output[0]); continue; }
      if (blockedUsers.length) { const copy = onnx.NodeProto.decode(onnx.NodeProto.encode(n).finish()); copy.name = `${n.name}_fp32`; copy.output = [`${n.output[0]}_fp32`]; nodes.push(copy); keptFloat32.add(copy.output[0]); rewire(n.output[0], copy.output[0], u => blocked.has(u)); }
      convertTensor(a.t);
    }
    nodes.push(n);
    // Graph outputs produced in float16 are cast back to float32 under their original name.
    n.output = n.output.map(o => {
      if (!outputs.has(o) || types.get(o) !== FLOAT) return o;
      rewire(o, `${o}_fp16`, u => !blocked.has(u)); nodes.push(castNode(`${o}_fp16`, o, FLOAT)); return `${o}_fp16`;
    });
  }
  graph.node = nodes;
  return onnx.ModelProto.encode(model).finish();
}
