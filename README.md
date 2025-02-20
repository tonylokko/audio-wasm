# audio-wasm
Rust and Javascript example on audio recording to a bucket with effects. 

This is an example i put together on how to use a wasm module from inside an s3 bucket to write to an s3 bucket. 
Using client-side javascript is a really useful tool for static sites and you can do a lot of complicated things but webassembly allows us to use other languages to do a little more. 

The tool does the following. 
We host it all in an s3 bucket - in my case i used a datacore swarm one because i had access to it but any s3 compatible storage should do. 
The javascript side of the house handles the following: 

- we use the javascript aws s3 sdk to handle the upload with chunking done via the wasm implementation. 
- the effects and presets are set using javascript - processing done by rust
  
