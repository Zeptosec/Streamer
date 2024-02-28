# Audio, video and file streamer
streams chunked audio and video by chunking it even more. Useful when data is not whole and in chunks and you want to preview audio or video file. Also used for downloading files from thermastore
# How to use it?
clone project with, install dependencies and run it. Rename file `.env.example` to `.env` to make custom config, or just edit the source files.

This project is kind of broken, but it's in somewhat working state. Discord finally added hmac hashing, I could not find any docs on how to update urls, so I found my own solution. I don't know how long it will work or how reliable it is, but for now it works. 

You need to add your discord (preferably your temp account that won't ever be used) Authorization token in the `.env` file
```
USER_AUTH_TOKEN=YourTokenGoesHereIn.PlainText
```
## Side notes
If video is not playing it could be because of origin problems. Add `crossorigin=""` attribute to video tag.
