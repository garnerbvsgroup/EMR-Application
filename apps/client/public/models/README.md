# Model Drop Folder

Drop real glTF binary models here to replace the fallback procedural meshes.

Expected filenames:
- `player.glb`
- `vehicle.glb`

Notes:
- The app automatically checks for these files at runtime.
- If a file exists, the imported model is used.
- If a file does not exist, the app falls back to the built-in procedural model.
- Prefer permissive assets you have the right to use, such as CC0 or clearly licensed CC-BY models.
- Keep models centered near the world origin and facing forward for best results.
- Large models and 4K textures will hurt performance on lower-end machines.

Recommended sources to review yourself before adding assets:
- Khronos glTF Sample Assets
- Poly Haven
- Other clearly licensed glTF model sources
