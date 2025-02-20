# audio-wasm
Rust and Javascript example on audio recording to a bucket with effects. 

This is an example i put together on how to use a wasm module from inside an s3 bucket to write to an s3 bucket. 
Using client-side javascript is a really useful tool for static sites and you can do a lot of complicated things but webassembly allows us to use other languages to do a little more. 

The tool does the following. 
We host it all in an s3 bucket - in my case i used a datacore swarm one because i had access to it but any s3 compatible storage should do. 
The javascript side of the house handles the following: 

- we use the javascript aws s3 sdk to handle the upload with chunking done via the wasm implementation. 
- the effects and presets are set using javascript - processing done by rust

Usage -> 
The initial storage configuration for the bucket that we're going to store data in looks like this. 
  
![initialstorage](https://github.com/user-attachments/assets/8524decf-3df8-492d-8b4f-6489c771f235)

Once we've connected the recording screen looks like this

![initialrecording](https://github.com/user-attachments/assets/05ff2dac-55f8-46ad-9b9b-5fd637e22ac8)

When we click on start recording the webbrowser will prompt for what microphone to use. 

![micgrab](https://github.com/user-attachments/assets/6c2efcc6-1413-4804-967f-4a72cc015c6a)

Then once its allowed the audio stream starts to send to the wasm module with any effects we have enabled. 

When the user clicks stop recording it saves to the bucket which then creates the file. 
Any file in the list can be played back or deleted from the front page. 

![playbackordelete](https://github.com/user-attachments/assets/5a3c00f9-f364-4590-85c5-48060a137e61)


