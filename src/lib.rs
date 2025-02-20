use wasm_bindgen::prelude::*;
use web_sys::{MediaRecorder, MediaStream, MediaStreamConstraints};
use js_sys::{Array, Float32Array, Promise};
use std::collections::VecDeque;
use serde::{Serialize, Deserialize};
use std::f32::consts::PI;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[derive(Clone, Copy, Serialize, Deserialize)]
pub struct DelayParams {
    delay_time: f32,
    feedback: f32,
    mix: f32,
}

#[derive(Clone, Copy, Serialize, Deserialize)]
pub struct DistortionParams {
    drive: f32,
    tone: f32,
    mix: f32,
}

#[derive(Clone, Copy, Serialize, Deserialize)]
pub struct ChorusParams {
    rate: f32,
    depth: f32,
    mix: f32,
}

#[derive(Clone, Copy, Serialize, Deserialize)]
pub struct TremoloParams {
    rate: f32,
    depth: f32,
}

struct DelayLine {
    buffer: VecDeque<f32>,
    max_delay: usize,
}

impl DelayLine {
    fn new(max_delay_samples: usize) -> Self {
        Self {
            buffer: VecDeque::with_capacity(max_delay_samples),
            max_delay: max_delay_samples,
        }
    }

    fn write(&mut self, sample: f32) {
        self.buffer.push_back(sample);
        if self.buffer.len() > self.max_delay {
            self.buffer.pop_front();
        }
    }

    fn read(&self, delay_samples: usize) -> f32 {
        let index = self.buffer.len().saturating_sub(delay_samples);
        self.buffer.get(index).copied().unwrap_or(0.0)
    }
}

struct EffectProcessor {
    delay_line: DelayLine,
    chorus_phase: f32,
    tremolo_phase: f32,
    sample_rate: f32,
    last_sample: f32,
}

impl EffectProcessor {
    fn new(sample_rate: f32) -> Self {
        Self {
            delay_line: DelayLine::new((sample_rate * 2.0) as usize), // 2 seconds max delay
            chorus_phase: 0.0,
            tremolo_phase: 0.0,
            sample_rate,
            last_sample: 0.0,
        }
    }

    fn process_delay(&mut self, sample: f32, params: &DelayParams) -> f32 {
        let delay_samples = (params.delay_time * self.sample_rate) as usize;
        let delayed = self.delay_line.read(delay_samples);
        self.delay_line.write(sample + delayed * params.feedback);
        sample * (1.0 - params.mix) + delayed * params.mix
    }

    fn process_distortion(&mut self, sample: f32, params: &DistortionParams) -> f32 {
        let distorted = (sample * params.drive).tanh();
        let tone_filtered = distorted * params.tone + self.last_sample * (1.0 - params.tone);
        self.last_sample = tone_filtered;
        sample * (1.0 - params.mix) + tone_filtered * params.mix
    }

    fn process_chorus(&mut self, sample: f32, params: &ChorusParams) -> f32 {
        let base_delay_samples = (0.02 * self.sample_rate) as usize; // 20ms base delay
        let depth_samples = (0.01 * self.sample_rate * params.depth) as usize;

        self.chorus_phase += params.rate / self.sample_rate;
        if self.chorus_phase >= 1.0 {
            self.chorus_phase -= 1.0;
        }

        let mod_delay = base_delay_samples + 
            (depth_samples as f32 * (2.0 * PI * self.chorus_phase).sin()) as usize;

        self.delay_line.write(sample);
        let delayed = self.delay_line.read(mod_delay);
        sample * (1.0 - params.mix) + delayed * params.mix
    }

    fn process_tremolo(&mut self, sample: f32, params: &TremoloParams) -> f32 {
        self.tremolo_phase += params.rate / self.sample_rate;
        if self.tremolo_phase >= 1.0 {
            self.tremolo_phase -= 1.0;
        }

        let modulation = 1.0 - params.depth * 0.5 * (1.0 + (2.0 * PI * self.tremolo_phase).sin());
        sample * modulation
    }
}

#[wasm_bindgen]
pub struct AudioHandler {
    recorder: Option<MediaRecorder>,
    chunks: Array,
    effect_processor: EffectProcessor,
}

#[wasm_bindgen]
impl AudioHandler {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Result<AudioHandler, JsValue> {
        console_error_panic_hook::set_once();
        
        Ok(AudioHandler {
            recorder: None,
            chunks: Array::new(),
            effect_processor: EffectProcessor::new(48000.0),
        })
    }

    #[wasm_bindgen]
    pub async fn start_recording(&mut self) -> Result<(), JsValue> {
        let window = web_sys::window().unwrap();
        let navigator = window.navigator();
        let media_devices = navigator.media_devices()?;

        let constraints = MediaStreamConstraints::new();
        constraints.set_audio(&JsValue::TRUE);

        let stream_promise = media_devices.get_user_media_with_constraints(&constraints)?;
        let stream: MediaStream = wasm_bindgen_futures::JsFuture::from(stream_promise)
            .await?
            .dyn_into()?;

        let recorder = MediaRecorder::new_with_media_stream(&stream)?;
        
        let chunks = self.chunks.clone();
        let ondataavailable = Closure::wrap(Box::new(move |event: web_sys::BlobEvent| {
            if let Some(blob) = event.data() {
                chunks.push(&blob.into());
            }
        }) as Box<dyn FnMut(web_sys::BlobEvent)>);

        recorder.set_ondataavailable(Some(ondataavailable.as_ref().unchecked_ref()));
        ondataavailable.forget();

        recorder.start_with_time_slice(100)?;
        self.recorder = Some(recorder);

        Ok(())
    }

    #[wasm_bindgen]
    pub fn stop_recording(&mut self) -> Result<Promise, JsValue> {
        let recorder = self.recorder.take().ok_or("No recorder found")?;
        let chunks = self.chunks.clone();

        let promise = Promise::new(&mut |resolve, _reject| {
            let chunks_clone = chunks.clone();
            let on_stop = Closure::wrap(Box::new(move || {
                let blob = web_sys::Blob::new_with_buffer_source_sequence(&chunks_clone).unwrap();
                resolve.call1(&JsValue::NULL, &blob.into()).unwrap();
            }) as Box<dyn FnMut()>);

            recorder.set_onstop(Some(on_stop.as_ref().unchecked_ref()));
            on_stop.forget();
        });

        recorder.stop()?;
        self.chunks = Array::new();
        
        Ok(promise)
    }

    #[wasm_bindgen]
    pub fn process_audio(&mut self, samples: Float32Array, effect_params_str: &str) -> Result<Float32Array, JsValue> {
        // Parse effect parameters
        let effect_params: serde_json::Value = serde_json::from_str(effect_params_str)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        let mut input_buffer = vec![0.0; samples.length() as usize];
        samples.copy_to(&mut input_buffer);
        
        let mut output_buffer = input_buffer.clone();

        // Apply effects based on parameters
        if let Some(delay) = effect_params.get("delay") {
            let params: DelayParams = serde_json::from_value(delay.clone())
                .map_err(|e| JsValue::from_str(&e.to_string()))?;
            output_buffer.iter_mut().for_each(|sample| {
                *sample = self.effect_processor.process_delay(*sample, &params);
            });
        }

        if let Some(distortion) = effect_params.get("distortion") {
            let params: DistortionParams = serde_json::from_value(distortion.clone())
                .map_err(|e| JsValue::from_str(&e.to_string()))?;
            output_buffer.iter_mut().for_each(|sample| {
                *sample = self.effect_processor.process_distortion(*sample, &params);
            });
        }

        if let Some(chorus) = effect_params.get("chorus") {
            let params: ChorusParams = serde_json::from_value(chorus.clone())
                .map_err(|e| JsValue::from_str(&e.to_string()))?;
            output_buffer.iter_mut().for_each(|sample| {
                *sample = self.effect_processor.process_chorus(*sample, &params);
            });
        }

        if let Some(tremolo) = effect_params.get("tremolo") {
            let params: TremoloParams = serde_json::from_value(tremolo.clone())
                .map_err(|e| JsValue::from_str(&e.to_string()))?;
            output_buffer.iter_mut().for_each(|sample| {
                *sample = self.effect_processor.process_tremolo(*sample, &params);
            });
        }

        // Convert back to Float32Array
        let result = Float32Array::new_with_length(output_buffer.len() as u32);
        result.copy_from(&output_buffer);
        Ok(result)
    }
}
