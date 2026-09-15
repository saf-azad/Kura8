"""Convert the ISNet general-use checkpoint to float16 for the background remover (see scripts/prepare-model.mjs).

Usage:  uv venv .venv && VIRTUAL_ENV=.venv uv pip install onnx onnxruntime onnxconverter-common numpy
        .venv/bin/python scripts/to_fp16.py isnet-general-use.onnx isnet-general-use_fp16.onnx

Drops the five side outputs and six decoder features (training aids the app never fetches), converts weights and
compute to float16 with inputs/outputs kept float32, checks the graph, then compares against the fp32 model on a
random input. Pin the printed SHA-256 in prepare-model.mjs and host the file where RATIO_MODEL_FP16_URL points.
"""
import sys, time, onnx, numpy as np, onnxruntime as ort
from onnxconverter_common import float16
src, dst = sys.argv[1], sys.argv[2]
t = time.time()
m = onnx.load(src)
# Keep only the fused prediction; the five side outputs and six decoder features are training aids.
keep = [o for o in m.graph.output if o.name == 'output_image']
del m.graph.output[:]
m.graph.output.extend(keep)
m = onnx.shape_inference.infer_shapes(m)
m16 = float16.convert_float_to_float16(m, keep_io_types=True, disable_shape_infer=False)
onnx.checker.check_model(m16)
onnx.save(m16, dst)
print('fp16 written in', round(time.time() - t), 's; outputs', [o.name for o in m16.graph.output])
s = ort.InferenceSession(dst, providers=['CPUExecutionProvider'])
x = (np.random.rand(1, 3, 1024, 1024).astype(np.float32) - 0.5)
t = time.time(); y = s.run(['output_image'], {'input_image': x})[0]; print('fp16 cpu run', round(time.time() - t, 1), 's; output', y.shape, y.dtype, float(y.min()), float(y.max()))
s32 = ort.InferenceSession(src, providers=['CPUExecutionProvider'])
t = time.time(); y32 = s32.run(['output_image'], {'input_image': x})[0]; print('fp32 cpu run', round(time.time() - t, 1), 's')
print('max abs diff vs fp32', float(np.abs(y - y32).max()), 'mean abs diff', float(np.abs(y - y32).mean()))
