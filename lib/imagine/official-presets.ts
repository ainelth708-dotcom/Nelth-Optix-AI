// ---------------------------------------------------------------------------
// Official preset catalog for /imagine: the 50 example cards backed by the
// real artwork in our ImageKit media library
// (https://ik.imagekit.io/big9hcdtmk), across 3 folders:
// - "generateur image" (3): text-to-image prompts
// - "image edit" (42): image-to-image edit prompts (work best with a source
//   image attached via +)
// - "video gen" (5): text-to-video prompts (mp4 files — the card shows the
//   first frame as thumbnail)
// Each card follows its file name (label) and its prompt.
// ---------------------------------------------------------------------------

export type OfficialPresetKind = 'image' | 'video'
export type OfficialPresetCategory = 'edit' | 'generate' | 'video'

export interface OfficialPreset {
  id: string
  label: string
  prompt: string
  /** ImageKit file URL (image, or mp4 for video presets). */
  image: string
  /**
   * Video-only poster (ImageKit ik-thumbnail.jpg first frame): used for
   * the card thumbnail and the player poster. A raw <video> with
   * preload="metadata" stays blank on several mobile browsers, so video
   * cards never rely on it.
   */
  poster?: string
  kind: OfficialPresetKind
  category: OfficialPresetCategory
}

export const OFFICIAL_PRESETS: OfficialPreset[] = [
  {
    id: 'grocery-shops-3x3',
    label: 'Grocery Shops Through Ages 3x3 Grid',
    category: 'generate',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/generateur%20image/Grocery%20Shops%20Through%20Ages%203x3%20Grid.jpg',
    prompt: `A 3x3 grid of ultra-detailed 12K 3D-rendered tiny scenes depicting grocery shops through ages, scaled at 1:12. Placed on AI inferred material pedestal with engraved motifs. Warm afternoon rays from right create intimate, sharp castings. Panels cover 300 BC, 1000 AD, 1500 AD, 1700 AD, 1900 AD, 1950 AD, 2000 AD, 2100 AD, and future 2500 AD variants.`
  },
  {
    id: 'technical-annotation-infographic',
    label: 'Photorealistic Technical Annotation Infographic',
    category: 'generate',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/generateur%20image/Photorealistic%20Technical%20Annotation%20Infographic.jpg',
    prompt: `Create an infographic image of [OBJECT], combining a realistic photograph or photoreal render of the object with technical annotation overlays placed directly on top.

Use black ink–style line drawings and text (technical pen / architectural sketch look) on a pure white studio background, including:
•Key component labels
•Internal cutaway or exploded-view outlines
•Measurements, dimensions, and scale markers
•Material callouts and quantities
•Arrows indicating function, force, or flow (air, sound, power, pressure)
•Simple schematic or sectional diagrams where relevant

Place the title [OBJECT] inside a hand-drawn technical annotation box in one corner.

Style & layout rules:
•The real object remains clearly visible beneath the annotations
•Annotations feel sketched, technical, and architectural
•Clean composition with balanced negative space
•Educational, museum-exhibit / engineering-manual vibe

Visual style:
Minimal technical illustration aesthetic, black linework over realistic imagery, precise but slightly hand-drawn feel.

Color palette:
White background, black annotation lines and text only. No colors.

Output:
1080×1080, ultra-crisp, social-feed optimized, no watermark.`
  },
  {
    id: 'exploded-food-infographic',
    label: 'Hyper-Realistic Exploded Food Infographic',
    category: 'generate',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/generateur%20image/Hyper-Realistic%20Exploded%20Food%20Infographic.jpg',
    prompt: `Create a hyper-realistic exploded vertical infographic composition of [FOOD].
At the top, characteristic particles, droplets, or garnishes associated with the food, frozen mid-air.
Below it, the primary surface or topping layer with rich texture and realistic material detail.
Underneath, the core ingredient layer showing structure, depth, and natural variation.
Below that, the supporting base or interior layer, slightly separated to reveal construction.
At the bottom, a minimal plate, bowl, cup, or base appropriate to the food’s presentation.
Pure white background, soft studio lighting, subtle shadows beneath each floating element, ultra-sharp focus, DSLR macro photography, clean infographic text labels with thin pointer lines, premium editorial food photography aesthetic, 8K quality.`
  },
  {
    id: 'human-pixar-composite',
    label: 'Hyper-Realistic Human × Pixar 3D Character Studio Composite',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Hyper-Realistic%20Human%20%C3%97%20Pixar%203D%20Character%20Studio%20Composite.jpg',
    prompt: `Ultra-hyperrealistic cinematic urban photography, premium DSLR aesthetic, mixed-media composition combining photorealistic human photography with a cute stylized 3D cartoon/chibi character, modern street-fashion editorial aesthetic, natural daylight, soft realistic shadows, cinematic color grading, high dynamic range, realistic skin and clothing textures, 50mm lens look, shallow depth of field, crisp subject focus, modern glass architecture, clean urban environment, sophisticated Instagram lifestyle aesthetic, playful contrast between real life and animated character design, ultra-detailed, photorealistic rendering, premium visual quality, 8K.`
  },
  {
    id: 'night-street-red-roses',
    label: 'Night-time Street Style with Red Roses',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Night-time%20Street%20Style%20with%20Red%20Roses.jpg',
    prompt: `A stunning, candid night-time street style photo of a radiant young woman in a chic beige oversized trench coat. She is walking away from a luxury restaurant, holding a massive, overflowing armful of long-stemmed red roses and a small designer shopping bag. She is partially turned back toward the camera with a brilliant, genuine laugh. The background is a beautifully blurred metropolitan street at night, with a bokeh effect of city lights, glowing shop windows, and wet pavement reflecting the neon signs. The lighting is cinematic: warm golden light from a nearby window hits her face, while cool street-light accents her hair. High-quality smartphone photography with realistic skin textures, subtle motion blur to capture the movement, and a shallow depth of field. Every detail of the roses and the trench coat fabric is crisp. Intense "main character energy" and high-end lifestyle aesthetic-ar 4:5`
  },
  {
    id: 'night-street-flash',
    label: 'Night Street Portrait with Flash',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Night%20Street%20Portrait%20with%20Flash.jpg',
    prompt: `Night street portrait of a stylish young woman with long dark hair wearing a loose dark denim jacket and black top, standing on a city sidewalk beside a red and white traffic cone, direct camera flash illuminating her face and jacket, glossy skin highlights, warm yellow streetlights and cars in the background, softly blurred urban buildings and pedestrians, cinematic nighttime atmosphere, street photography style, high detail, realistic lighting, 35mm flash photography, shallow depth of field.`
  },
  {
    id: 'restore-colorize',
    label: 'Restore and Colorize Old Photograph',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Restore%20and%20Colorize%20Old%20Photograph.jpg',
    prompt: `Restore and colorize the uploaded old photograph into a crystal-clear, photorealistic, high-detail image while preserving 100% of the original composition. Keep the exact same pose, expression, facial structure, proportions, framing, clothing, hairstyle, background, objects, and all details unchanged. Do not add, remove, move, or restyle anything. Remove blur, noise, scratches, fading, stains, and age-related damage. Recover natural sharpness, fine skin texture, realistic textures, true-to-life colors, and lifelike skin tones. No identity change, no stylization, no cartoon or CGI look, no plastic skin.`
  },
  {
    id: 'photobooth-expression-grid',
    label: 'Black-and-White Photobooth Expression Grid',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Black-and-White%20Photobooth%20Expression%20Grid.jpg',
    prompt: `Create a black-and-white photobooth 4×4 expression grid using the reference image as the main anchor. The same woman’s identity, facial features, and hairstyle must be preserved with very high similarity across all panels.
The final image should be square (1:1), ultra-high resolution, arranged as a 16-panel grid with thin spacing. Each panel is a tight head-and-shoulders shot (50mm look) with sharp eyes. Use a plain gray background, direct front photobooth flash, soft short shadows, and subtle analog black-and-white grain with medium-high contrast.
She should wear a simple modest top (no logos) with natural makeup and consistent hairstyle.
Each panel shows a different expression: scrunched smile, intense stare with fingers framing eyes, big laugh, bored face with chin in hands, sad pout, goofy horns gesture, tongue-out grin, angry glare, flirty cheek touch, surprised wide eyes, excited shout with hands near face, mischievous claw pose, confused frown, dramatic crying with hands on head, playful eyes-closed tongue out, duck face with small devil horns gesture.
Avoid distorted anatomy, extra fingers, plastic skin, blur, text, logos, or color.`
  },
  {
    id: 'woman-relaxing-couch',
    label: 'Woman Relaxing on Couch, Soft Lighting, UGC Realism',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Woman%20Relaxing%20on%20Couch,%20Soft%20Lighting,%20UGC%20Realism.jpg',
    prompt: `Edit the image so the same woman is lying comfortably on a soft couch, turned slightly on her side with her head resting against a cushion. She is wearingsame clothes full boody cover , hair loose and slightly messy, with a calm and natural expression, no glasses. The room is softly lit by warm indoor lighting from a nearby lamp, creating a gentle glow across her face with smooth falloff and no harsh shadows. The framing should feel casual and candid, like a late-night phone photo taken while relaxing in the living room. Maintain authentic UGC-style realism with subtle digital noise, slightly imperfect exposure, and realistic skin texture including pores, freckles, and natural softness`
  },
  {
    id: 'afterparty-pizza',
    label: 'Flash Editorial After-Party Portrait of Couple Eating Pizza',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Flash%20Editorial%20After-Party%20Portrait%20of%20Couple%20Eating%20Pizza.jpg',
    prompt: `Create a photorealistic flash editorial portrait of a stylish young couple sitting casually on a beige carpeted floor during a late-night wedding afterparty, eating pizza together. The image should feel candid, cool, intimate, slightly messy, and effortlessly fashionable, like a real spontaneous snapshot captured at the end of a wedding night.

Use a **4:5 portrait composition** with an ultra-high-resolution, crisp photographic appearance. The visual language should resemble a direct on-camera flash fashion snapshot: eye-level camera, tight indoor framing, realistic shadow falloff across the plain wall and carpet. The photograph must feel authentic and imperfect rather than overly produced.

Use **hard direct camera flash only**. Do not use soft studio lighting, cinematic lighting, artificial glow, bloom, or dramatic movie-style illumination. The flash should create realistic hard shadows behind the couple and natural falloff across the wall and floor.

Show exactly **two people: one young man and one young woman**. They should look stylish and attractive but completely natural, relaxed, and not overly posed. Their body language should feel spontaneous and believable. Their expressions should be cool, casual, and slightly playful, with subtle eye contact or naturally looking away rather than exaggerated posing.

The young man wears a **black suit with a slightly loosened black tie and a white dress shirt**, creating a late-night, slightly undone formal wedding look.

The young woman wears a **short white satin dress**, elegant and minimal, with long dark wavy hair and soft glam makeup. Her styling should feel fashionable and sophisticated while still believable for a wedding afterparty.

Both subjects must have **realistic skin texture and detailed natural facial features**. Avoid beauty retouching, excessive smoothing, plastic-looking skin, artificial perfection, or overly polished faces. Preserve pores, subtle skin variations, and natural imperfections.

Place several **open pizza boxes** naturally on the floor around them. The couple should each be holding realistic pizza slices, with convincing melted cheese, browned crust, and authentic food texture. Add clear plastic cups, napkins, and a small amount of casual party clutter around the floor. The mess should feel believable and spontaneous, never artificially arranged.

The pizza boxes must contain **no readable brand names, logos, or identifiable text**.

Set the scene in a **minimal indoor room** with a plain off-white wall and a beige carpet floor. Keep the background simple and mostly empty, with no furniture dominating the composition and no distracting decorations. The carpet should have subtle realistic texture and natural imperfections.

The overall aesthetic should resemble a **high-end fashion editorial captured with a compact camera and direct flash at a private wedding afterparty**: spontaneous, intimate, cool, stylish, slightly chaotic, and authentic.

Use a **clean neutral flash color grade**, subtle film grain, crisp detail, realistic dynamic range, and natural photographic contrast. Do not use HDR processing.`
  },
  {
    id: 'smartphone-selfie-car',
    label: 'Realistic Smartphone Selfie in a Modern Car',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Realistic%20Smartphone%20Selfie%20in%20a%20Modern%20Car.jpg',
    prompt: `Create a hyper-photorealistic, candid front-facing smartphone selfie of the same woman shown in the uploaded reference photo. Use the uploaded photo as an **exact facial identity reference**. Preserve every recognizable facial feature, facial proportions, skin detail, and natural expression without altering, beautifying, or redesigning her face.

The woman is sitting in the **driver's seat of a modern car during daytime**, taking a casual selfie. Frame the image vertically in a **9:16 aspect ratio**, from approximately her upper chest to the top of her head.

She holds a **dark gray iPhone with a clearly visible triple-camera module** in her right hand, extended at approximately arm's length in a natural selfie position. She is looking directly toward the phone screen with a relaxed, subtle closed-mouth smile and natural eye contact. Her head is tilted approximately **5–10 degrees toward her left**, creating a spontaneous, candid feeling.

Simulate a realistic smartphone front-camera photograph using approximately a **24–28mm equivalent focal length**. Use a natural wide-angle smartphone perspective with only very mild edge distortion typical of an authentic phone selfie. Keep the camera approximately at eye level.

Bright natural daylight enters through the windshield and side windows during a clear mid-morning or early-afternoon day. The lighting should create soft, even illumination across her face, with gentle highlights on the cheekbones, nose, and forehead, subtle natural catchlights in her eyes, and realistic soft shadows beneath her chin and around the lower face caused by the dashboard.

Preserve **authentic unretouched skin**: visible pores, natural skin texture, subtle imperfections, fine facial detail, and a slight natural oil sheen where appropriate. Do not smooth, airbrush, beautify, or apply digital beauty filters.

She has **medium-length dark brown hair with soft loose waves**, slightly tousled from driving. A few individual strands naturally fall across her forehead.

She wears a casual everyday outfit consisting of a **fitted white cotton T-shirt or simple crew-neck shirt**, paired with a light denim jacket or an open cardigan. Add a small delicate gold necklace and simple stud earrings. If the reference photo shows a delicate fine-line tattoo on her inner right forearm and that area is visible in the composition, preserve the tattoo accurately.

The environment is a clean, modern car interior with **black or gray leather seats**, a visible steering wheel on the left, and a realistic dashboard with subtle reflections. Through the side window, show a softly blurred outdoor street, parking lot, trees, buildings, or road. Use natural optical depth of field and subtle realistic bokeh so the background remains believable but non-distracting.

Prioritize extremely realistic photographic details on the woman's face, hair, hands, phone, clothing, car interior, reflections, and lighting. Keep the face and the hand holding the phone sharply focused while maintaining natural smartphone-camera depth and lens characteristics.

Use photorealistic natural colors, realistic contrast, high dynamic range without an artificial HDR appearance, and authentic smartphone image rendering. Include subtle natural camera characteristics but avoid excessive sharpening or artificial processing.

The final image should look like a **genuine everyday smartphone selfie taken inside a car**, spontaneous and completely believable, rather than a professional studio portrait or AI-generated image.

Negative constraints: blurry image, distorted or changed facial identity, altered facial proportions, plastic skin, beauty filters, airbrushed skin, doll-like appearance, excessive makeup, exaggerated facial symmetry, malformed hands, extra fingers, missing fingers, warped phone, distorted reflections, artificial text, watermark, logos, oversaturated colors, cartoon appearance, 3D-rendered appearance, low resolution, JPEG artifacts, excessive digital noise, nighttime lighting, dim lighting, suggestive posing, or unnecessarily exposed skin.`
  },
  {
    id: 'camel-coat-porsche',
    label: 'Man in Camel Coat with Vintage Porsche Targa',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Man%20in%20Camel%20Coat%20with%20Vintage%20Porsche%20Targa.jpg',
    prompt: `Create a highly realistic, sophisticated editorial photograph of a Caucasian man in his late 30s to early 40s standing beside a vintage silver Porsche Targa in an elegant countryside setting.

Use a **4:5 portrait aspect ratio** with a multi-element composition following the **rule of thirds**. The primary focal points are the man's sharply focused face and upper torso, followed by the vintage silver Porsche Targa. The visual hierarchy should naturally guide the viewer's eye from the man's face, down his light-colored outfit, across the elegant silver curves of the classic Porsche, and finally toward the surrounding background foliage.

Use an **asymmetric composition** that remains visually balanced and refined. Maintain a straight-on photographic perspective.

The man wears a **camel-colored double-breasted overcoat**, worn naturally and elegantly over an **unbuttoned white dress shirt**, paired with **cream/off-white trousers** and **brown suede loafers**. His overall appearance should embody timeless classic menswear.

His hairstyle is a **medium-length classic gentleman's cut**, approximately 3–4 inches on top, swept backward with a natural wave and tapered sides. Preserve realistic hair texture, individual strands, natural volume, and subtle imperfections.

The visual atmosphere should evoke a **wealthy but relaxed countryside weekend**, combining classic tailoring with appreciation for vintage automotive design. The image should feel like a premium men's fashion and automotive lifestyle editorial rather than a staged commercial photograph.

Use a warm, moderately saturated color palette with neutral contrast. The dominant colors are **deep forest green foliage**, approximately 45% of the image; **silver and grey** from the Porsche, approximately 25%; **camel** from the man's coat, approximately 20%; and **cream/off-white** from his clothing, approximately 10%.

Use **bright natural golden sunlight** from a single source positioned approximately **45 degrees to the side**. The lighting should be highly directional and relatively hard, producing sophisticated dramatic contrast.

Create **harsh, clearly defined shadows with deep dark density**, including the man's shadow falling onto the car and strong shadowing underneath the Porsche on the ground. Shadows should have a medium length and remain physically believable.

Add warm sunlight highlights to the **right side of the camel coat**, the **chrome side mirror**, and the **right side of the man's face**. Direct sunlight hitting portions of the coat may produce slightly blown-out highlights, while the polished silver Porsche should display realistic crisp specular reflections.

Maintain some natural ambient fill so that shadow areas retain realistic detail without eliminating the dramatic contrast. The overall light temperature should be **warm and golden**.

Use a **digital photography** aesthetic with a realistic photographic rendering, extremely sharp textures, tack-sharp focus, subtle film grain, medium depth of field, and natural optical characteristics.

The man's face and upper body should be exceptionally sharp and detailed, with realistic skin texture, pores, natural facial detail, and authentic proportions. The Porsche should also have highly detailed metallic paint, chrome components, realistic reflections, and authentic vintage automotive surfaces.

The background foliage should remain naturally detailed but slightly softened by the medium depth of field, creating a refined separation between the subjects and the countryside environment.

Subtly integrate the word **“targa”** directly onto the Porsche's roll bar using a **regular vintage-style script font**. The lettering must look physically integrated into the vehicle, understated and authentic rather than appearing as added floating text.

The overall artistic direction should combine **classic menswear photography** with **vintage automotive lifestyle editorial photography**. Keep the visual style clean, sophisticated, timeless, understated, and luxurious.

Prioritize photographic realism above everything else: realistic anatomy, natural posture, authentic clothing folds, believable fabric texture, physically accurate sunlight and shadows, realistic metallic reflections, natural foliage, subtle film grain, and genuine camera optics.

Avoid artificial CGI appearance, excessive HDR, plastic skin, excessive retouching, artificial glow, cinematic haze, unrealistic reflections, exaggerated colors, distorted anatomy, unnatural clothing, overly perfect surfaces, excessive sharpening, or a synthetic AI-generated appearance.

The final photograph should look like a **real high-end editorial photograph captured with a professional digital camera during a warm countryside afternoon**, featuring a timeless gentleman and a beautifully preserved vintage silver Porsche Targa.`
  },
  {
    id: 'calm-in-chaos',
    label: 'Calm in Chaos Focused Portrait in a Busy City',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Calm%20in%20Chaos%20%20Focused%20Portrait%20in%20a%20Busy%20City.jpg',
    prompt: `Create a realistic photo of a person using the face from the uploaded image. The person is standing still in the middle of a busy street or public place, looking calm and confident. Many people are moving around them, but they appear blurred because of motion, while the main person is sharp and in focus. The camera is at eye level, centered on the person. The background looks like a city with soft lights and buildings. The person is wearing simple stylish clothes like a t-shirt, jacket, jeans, and sneakers. The lighting is natural and slightly cinematic with soft shadows. The overall scene should feel calm in the middle of chaos, with clear focus on the person and blurred crowd movement around.`
  },
  {
    id: 'tropical-hamsa-kimono',
    label: 'Tropical Portrait with Hamsa Charm and Kimono',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Tropical%20Portrait%20with%20Hamsa%20Charm%20and%20Kimono.jpg',
    prompt: `Create image: Use the attached reference image as a visual guide for the character’s appearance, maintaining strong resemblance to the person in the reference. Preserve key visual traits such as facial structure and overall proportions, while allowing small natural variations typical of real photography. The generated subject should clearly resemble the reference while remaining a natural photographic interpretation.
Aspect Ratio: 4:5.
A hyper-realistic, ultra-sharp photograph taken on a modern smartphone, characterized by its digital clarity, captures a woman in a vibrant outdoor tropical setting under bright sunlight. She is positioned with her left hand gently touching her long, straight, dark brown hair, which is parted down the middle, while her right hand rests on her hip, and her gaze is directed downwards. She is dressed in a white deep V-neck swimsuit or bodysuit with subtle side cutouts, paired with light wash denim jeans and a flowing, sheer pink floral kimono featuring bell sleeves and vibrant yellow, blue, and green floral patterns. She accessorizes with delicate layered necklaces, one bearing a hamsa charm, and simple hoop earrings. Her makeup is subtle, featuring a soft winged eyeliner and natural pink lips. The background is in full, sharp focus without any bokeh or background blur, revealing lush green tropical foliage, a prominent tree with detailed branches, and a textured bamboo fence, all bathed in intense sunlight with prominent sun lens flares. This image, captured on an iPhone 15 Pro, exhibits a realistic, digital texture with ultra-sharp details, including naturally pinkish, dewy skin with a Korean glass skin finish and visible pores, completely free of film grain but with a hint of subtle digital noise. The lighting is bright and exceptionally even, typical of modern smartphone HDR processing, ensuring that shadows are lifted and never appear deep black, presenting a natural and true-to-life color palette.`
  },
  {
    id: 'travel-collage-consistent',
    label: 'Cinematic Travel Lifestyle Collage with Consistent Character',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Cinematic%20Travel%20Lifestyle%20Collage%20with%20Consistent%20Character.jpg',
    prompt: `using the attached reference photos as the identity and wardrobe source for the man, preserve the exact same facial features, face geometry, hairstyle and clothing from the references, create a photorealistic 2x2 collage of four cinematic travel lifestyle scenes with consistent color grading and atmosphere, as if shot on the same camera during one road trip. the same car model appears in all frames, matching color and interior. frame 1: man stepping out of the car on a mountain overlook at sunset, one hand on the open door, wind in hair, looking into the distance over clouds. frame 2: man sitting in the open trunk of the same car, playing an acoustic guitar, relaxed posture, warm autumn light, cozy blankets inside trunk. frame 3: interior car view from back seat, man driving, eyes visible in rearview mirror, one hand adjusting mirror, road glowing in golden light ahead. frame 4: man standing on a forest trail with backpack, looking up at tall trees, soft mist and green tones. natural cinematic lighting, cohesive warm earthy palette, subtle film grain, shallow depth of field, realistic skin texture with minimal professional retouching, lifestyle photography, 50mm lens look, f/2.8, no text, no watermark`
  },
  {
    id: 'beige-shirt-vintage-car',
    label: 'Man in beige shirt leaning on vintage car',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Man%20in%20beige%20shirt%20leaning%20on%20vintage%20car.jpg',
    prompt: `Transform the subject into a partially unbuttoned beige shirt and brown trousers leans against a {argument name="car color" default="yellow"} vintage car in a medium shot. The warm, diffused lighting highlights his relaxed pose in an industrial setting, with large {argument name="pipe color" default="yellow"} pipes in the blurred background. The image has a vintage aesthetic, focusing on the man and car with a shallow depth of field. 8k Ultra realstic`
  },
  {
    id: 'red-metal-door',
    label: 'Person in front of a red metal door',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Person%20in%20front%20of%20a%20red%20metal%20door.jpg',
    prompt: `Create a realistic photo of a person using the face from the uploaded image. The person is standing casually in front of a detailed red metal door with artistic patterns. The person is leaning slightly, with one hand in their pocket and a relaxed confident expression. They are wearing a white button-down shirt with the top buttons open, light-colored trousers, and stylish black sunglasses. Warm sunlight falls on the face and body, creating soft shadows and a golden glow. The background is simple but textured with the red door, giving a strong color contrast. The overall look is stylish, clean, and natural. Cinematic lighting, warm tones, realistic shadows, sharp focus, professional photography.`
  },
  {
    id: 'red-gradient-puffer',
    label: 'Studio Portrait with Red Gradient and Puffer Jacket',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Studio%20Portrait%20with%20Red%20Gradient%20and%20Puffer%20Jacket.jpg',
    prompt: `Turn my uploaded image into a clean studio-style portrait with a deep red gradient background and soft vertical panel textures. The subject is wearing a {argument name="jacket color" default="maroon"} oversized puffer jacket, a festive patterned sweater, and a cap with glasses, holding a large red-and-white candy cane. Use soft cinematic lighting, sharp focus, vibrant colors, and a polished commercial photography look. No text, no logos, no UI elements.`
  },
  {
    id: 'three-panel-collage',
    label: 'Three-Panel Fashion Collage with Bold Colors',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Three-Panel%20Fashion%20Collage%20with%20Bold%20Colors.jpg',
    prompt: `A high-resolution three-panel collage with a minimalist editorial aesthetic. The layout features one full-height vertical panel on the left and two equal square panels stacked vertically on the right, separated by thin white borders. The color story is a bold mix of candy pink, bright yellow, and soft teal. Left panel: A full-body shot of a woman in a {argument name="top color" default="mustard yellow"} blouse and {argument name="bottom color" default="terracotta"} wide-leg pants holding a red handbag against a solid pink background. Top right panel: A woman sitting on a yellow floor against a teal and pink geometric backdrop, wearing a yellow hoodie and headphones, smiling. Bottom right panel: A woman sitting on a yellow cube, laughing and wearing headphones. High-end commercial photography, studio lighting, sharp focus, vibrant saturation, 8k resolution.`
  },
  {
    id: 'orange-fashion-sunglasses',
    label: 'Playful Orange Fashion Portrait with Sunglasses',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Playful%20Orange%20Fashion%20Portrait%20with%20Sunglasses.jpg',
    prompt: `Create a highly photorealistic modern high-fashion editorial close-up portrait of a custom person based on the provided reference image. Use the reference image as the **exact identity and facial reference**. Preserve the person's recognizable facial structure, proportions, symmetry, defining features, natural skin tone, eye shape and color, eye expression, lip shape, lip fullness, and natural lip color. Do not alter, beautify, or redesign the facial identity.

The subject has a **messy, loosely tied-up hairstyle**, with slightly damp-looking hair and soft wispy strands naturally framing the face. Match the hair color precisely to the reference image. Preserve realistic individual hair strands, natural texture, volume, and imperfections.

She wears **medium-sized glossy bright-orange hoop earrings** and narrow oval sunglasses with a **black frame and vivid orange-tinted lenses**. The sunglasses are positioned low on the bridge of the nose, below the eyes, allowing her eyes to remain clearly visible above the lenses.

Her makeup is **soft natural glam**, adapted naturally to her features. Maintain a radiant but realistic skin finish with subtle natural glow. Use light mascara and delicate eye definition that enhances her natural eye shape without changing it. Her lips have a natural tinted gloss that complements her complexion.

She wears a **sleeveless textured knit top in vivid, highly saturated orange**. The fabric should have a subtle tactile knit texture with a slightly glossy modern finish. The orange should be bright, vibrant, and visually prominent without looking artificial.

Pose the subject facing directly toward the camera with relaxed shoulders. One hand is raised naturally toward her mouth, with the **index finger lightly touching the lower lip**. Her expression is playful and subtly teasing, while remaining elegant and believable.

Her gaze should establish **direct eye contact with the camera over the lowered sunglasses**. The emotional expression should communicate confidence, playfulness, and engagement without becoming exaggerated.

The overall mood is **playful, modern, stylish, light, fresh, and confident**, with a polished fashion-editorial aesthetic.

Use **bright, soft studio lighting** with even illumination across the face and minimal hard shadows. Create gentle highlights on the skin, sunglasses, earrings, and slightly glossy clothing. Keep the overall contrast low to medium with a clean, refined studio appearance.

Simulate a high-resolution **DSLR fashion photograph** captured with an **85mm portrait lens at f/2.8 and ISO 100**, with extremely sharp focus on the eyes. Maintain realistic optical depth of field and natural lens rendering.

Use a **front-facing camera angle** with a tight close-up crop showing the head and upper shoulders. Keep the subject centered in a clean, symmetrical composition.

The background should be a **plain light-gray to off-white studio backdrop**, completely clean and minimal, with no distracting objects, decorations, patterns, or environmental elements.

The color direction should emphasize **bright saturated orange** against neutral gray, off-white, and natural skin tones. The orange earrings, sunglasses lenses, and top should appear particularly vibrant and luminous while remaining photorealistic.

Render the image as **modern fashion editorial photography** with ultra-high detail, crisp resolution, realistic skin texture, visible pores, natural hair detail, authentic fabric texture, realistic glossy surfaces, and physically believable lighting.

Prioritize realistic human anatomy, natural hands and fingers, accurate facial identity, authentic skin texture, realistic hair strands, believable sunglasses reflections, and natural fabric behavior.

Avoid facial identity changes, altered facial proportions, artificial symmetry, plastic skin, excessive beauty retouching, airbrushed texture, unrealistic makeup, cartoon rendering, CGI appearance, excessive HDR, artificial glow, harsh shadows, oversmoothing, distorted hands, extra fingers, malformed fingers, warped sunglasses, unnatural reflections, excessive saturation outside the orange elements, distracting background objects, text, logos, or watermarks.

The final image should look like a **real premium fashion magazine portrait photographed in a professional studio**, with the vivid orange styling creating a bold contemporary visual signature.`
  },
  {
    id: 'pisa-selfie',
    label: 'Young Woman Selfie at Piazza del Duomo, Pisa',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Young%20Woman%20Selfie%20at%20Piazza%20del%20Duomo,%20Pisa.jpg',
    prompt: `Create image: 8k UHD, slightly desaturated color palette. Use the attached reference image as a visual guide for the character’s appearance. Preserve key visual traits such as facial structure and overall proportions, while allowing small natural variations typical of real photography. The generated subject should clearly resemble the reference while remaining a natural photographic interpretation.
Aspect Ratio: 3:4.
A hyper-realistic, ultra-sharp photograph taken on a modern smartphone, specifically an iPhone 15 Pro, characterized by its digital clarity. Shot on a modern high-end smartphone camera, wide-angle lens, ISO 50, f/1.8. The subject is a young woman in her early 20s, captured in a spontaneous, wide-angle selfie pose at the Piazza del Duomo in Pisa. Her right arm is extended forward toward the lens, creating a prominent foreshortened perspective, while her torso is angled 20 degrees to the left with her right shoulder naturally elevated. She has ash-blonde hair styled in shaggy layers with soft curtain bangs that appear slightly wind-tossed. Her expression is radiant and beaming, layered with a subtle nose scrunch from the bright sun; her eyes are partially visible behind dark brown tortoiseshell oval sunglasses, showing a joyful squint. Her skin exhibits a healthy radiance and a rosy warmth, featuring visible pores and a clear, dewy texture with soft highlights on the bridge and tip of the nose. She wears glossy, natural pinkish-mauve lips with a subtle shimmer and a subtle blush applied with high placement on the cheekbones. She is dressed in a crisp, white linen button-down shirt with a visible breast pocket and slightly wrinkled fabric texture, paired with a stack of various cream-colored beaded and pearl bracelets on her extended wrist. A large white canvas tote bag with thick straps is slung over her left shoulder. The background features the Leaning Tower of Pisa in microscopic detail, showing the intricate marble arches and weathered stone textures against a vibrant blue sky with scattered wispy clouds. The entire scene is rendered in incredibly sharp focus, from the foreground bracelets to the distant green hedges and white information kiosks, without any background blur or bokeh. The lighting is characterized by soft daylight that enhances the rosy skin tones and preserves a natural, low-contrast digital texture devoid of film grain.`
  },
  {
    id: 'futuristic-seated-editorial',
    label: 'Futuristic Fashion Editorial with Seated Female Model',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Futuristic%20Fashion%20Editorial%20with%20Seated%20Female%20Model.jpg',
    prompt: `Create a **photorealistic futuristic fashion editorial portrait** of the woman shown in the uploaded reference image.

Use the uploaded image as the **exact identity reference**. Preserve her facial identity precisely, including facial structure, proportions, recognizable features, skin characteristics, hairstyle, and facial expression. **Do not alter, redesign, beautify, or reinterpret her face. Do not change her expression.** Her face and hairstyle must remain consistent with the reference image.

The woman is **seated** in an elegant yet relaxed posture. Her body language should feel natural, confident, effortless, and editorial. Keep her facial expression exactly as it appears in the reference image.

She wears an **oversized white sweatshirt** with a contemporary, relaxed silhouette. Pair it with **oversized cloudy-blue combat jeans**, featuring a distinctive soft cloudy blue tone and realistic denim texture. Complete the outfit with **cloudy-blue neutral sneakers or modern Nike-style sneakers** and clean **white ribbed socks**.

Create the scene inside a professional minimalist **fashion studio**. The entire background should feature a sophisticated **muted sky-blue tone**, creating a monochromatic futuristic atmosphere. Keep the studio clean, seamless, minimal, and free of distracting objects.

Use **soft cinematic glow lighting** while maintaining realistic photography. The light should gently illuminate the subject and create subtle highlights across her natural skin texture, hair, sweatshirt, denim, socks, and sneakers. Preserve realistic shadows and dimensionality rather than creating an artificial glowing effect.

Use a **model-centered editorial composition** with balanced framing. The woman should remain the clear visual focus of the photograph. The seated pose, clothing silhouette, and surrounding negative space should create a refined high-fashion composition.

The aesthetic should combine **contemporary fashion editorial photography with a subtle futuristic aesthetic**. Keep the design sophisticated, minimal, clean, and modern rather than overly sci-fi or artificial.

Prioritize **photorealism and extremely high detail**. Preserve realistic skin pores and texture, individual hair strands, natural facial details, realistic fabric fibers, sweatshirt folds, denim texture, sneaker materials, and authentic studio lighting.

Maintain accurate human anatomy, realistic proportions, natural hands and fingers, believable seated posture, physically accurate clothing behavior, and realistic contact between the body, clothing, shoes, and studio floor.

The final image should look like a **premium futuristic fashion magazine editorial photographed in a professional studio**, with the muted sky-blue environment and cloudy-blue denim creating a cohesive visual identity while the woman's exact face, hairstyle, and expression remain faithfully preserved from the uploaded reference image.

**Do not change the face, facial features, hairstyle, or facial expression from the reference image.**`
  },
  {
    id: 'hair-dye-transformation',
    label: 'Step-by-Step Hair Dye Beauty Transformation Grid',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Step-by-Step%20Hair%20Dye%20Beauty%20Transformation%20Grid.jpg',
    prompt: `Create a photoreal 2x2 step-by-step beauty transformation grid featuring one young adult woman across four panels with very strong identity consistency. The sequence must read clearly as one continuous at-home hair dye process. Keep the woman visually identical in all panels: same facial structure, same skin tone, same age, same proportions, and same natural beauty direction. Prioritize realism, continuity, and clean anatomy over dramatic complexity. Keep poses simple, believable, and easy to read. Hair transformation must progress logically from dye application to wet post-wash hair, then slightly damp drying stage, then final styled result. The final hair color must be a rich deep auburn-red or dark copper-red with glossy dimensional depth, elegant and luxurious, never bright orange or ginger. Output as 2x2 grid with thin gutter, no outer border, maximum identity lock between panels. Render in premium beauty editorial realism with ultra editorial crisp sharpness, minimal grain, soft rich natural dynamic range, warm luxury beauty color grade. Close beauty portrait or medium-close portrait framing in every panel using 85mm premium portrait lens, sharp on face and hair texture, soft luxurious depth of field with strong facial detail retention. Professional beauty lighting with realistic home ambience, soft controlled flattering light, dimensional but natural, elegant highlights on hair, accurate skin rendering, realistic skin texture no plastic effect. Panel 1: hair dye application step at home, near a mirror or vanity, hair neatly sectioned, visible dye cream applied on front and side sections, one hand applying dye and other stabilizing the hair, simple white T-shirt or white blouse with small natural dye stains, easy readable pose, clean mirror presence without complex reflection distortion. Panel 2: immediately after washing, hair fully wet, darker and more saturated, slick texture, same woman, same white top still visible, calm front or three-quarter angle, no towel wrapping, no chaotic splashes. Panel 3: drying stage, hair slightly damp and softer, deep auburn-red tone becoming clearer, relaxed home beauty moment, simple pose, gentle natural volume beginning to appear. Panel 4: final result, smooth voluminous blow-dried deep auburn-red hair with polished shine and rich dimensional color, wearing green satin halter top tied at the neck and blue jeans, confident fresh expression, premium beauty campaign finish. The exact same woman must appear in every panel with clear identity. Hair color and texture must evolve logically from one panel to next. Beauty direction remains natural and consistent, only hair texture and final outfit change according to the story. All arms, hands, shoulders, neck and mirror interactions must remain physically realistic. Avoid: different woman in each panel, identity drift, different face shape, different age, salon setting, bright orange ginger hair, neon red hair, cartoon, plastic skin, blurry face, bad anatomy, extra fingers, missing fingers, deformed hands, broken wrists, awkward shoulders, impossible arm position, confusing mirror reflection, duplicate reflection, messy unrealistic dye splatter, chaotic composition, cheap lighting, low detail, text, logo, watermark.`
  },
  {
    id: 'red-carpet-editorial',
    label: 'High Fashion Red Carpet Editorial Portrait',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/High%20Fashion%20Red%20Carpet%20Editorial%20Portrait.jpg',
    prompt: `Create a **high-fashion red carpet editorial photograph** featuring the young woman from the provided reference image at a prestigious luxury event.

Use the uploaded reference image as the **strict facial and identity reference**. Preserve her identity exactly. Do not modify, redesign, beautify, or reinterpret her facial structure, facial proportions, recognizable features, natural skin tone, eye color, or hair color. Her face must remain immediately recognizable as the same person shown in the reference image. Keep her hairstyle consistent with the reference image while allowing it to appear professionally sleek and styled. Do not change the hair color or eye color.

The woman is standing confidently on a **luxury red carpet**, with her body slightly angled toward the camera. Her arms are relaxed and positioned elegantly. Capture her in a sophisticated walking or mid-step pose, as if photographed naturally by a professional red carpet photographer.

Her expression should be **strong, confident, slightly serious, and composed**, conveying an understated high-status presence without looking exaggerated or artificial.

Maintain her natural appearance while giving her a polished professional finish. Her skin should have a **smooth but realistic natural glow**, preserving authentic skin texture and subtle facial details. Apply sophisticated glamorous evening makeup with defined eyes and elegant facial contouring, while avoiding excessive retouching or an artificial appearance.

She wears a **long black lace evening gown** with a fitted, elegant silhouette. The gown should look luxurious, refined, bold, and impeccably tailored, with highly detailed realistic lace texture and natural fabric folds. Add sophisticated **statement earrings** and minimal complementary jewelry. The overall styling should evoke an exclusive luxury red carpet and high-fashion editorial campaign.

Set the scene at a prestigious **red carpet event**. Include a sophisticated event backdrop featuring tasteful abstract shapes, soft carpet flooring, and professional studio-style event lighting. The environment should feel authentic to a luxury awards ceremony, fashion event, or premiere while remaining visually clean and refined.

Use professional event lighting with **bright frontal illumination**, soft realistic shadows, and even exposure across the subject. Add a subtle natural glow to the skin without creating artificial bloom or excessive cinematic effects. Preserve dimensionality in the black gown and ensure the intricate lace remains clearly visible.

Capture the photograph at **eye level** in a full-body portrait composition. Keep the woman sharply focused from head to toe while allowing the event background to be slightly softened with natural depth of field. Maintain elegant proportions and realistic perspective.

Use an **editorial cinematic color grade** with warm-neutral tones, rich deep blacks, balanced saturation, and medium-to-high contrast. The black lace gown should retain visible texture and detail rather than becoming a featureless black silhouette.

Prioritize **high-fashion photographic realism**: realistic anatomy, natural body proportions, authentic facial details, realistic skin texture, individual hair strands, detailed lace fibers, physically accurate fabric folds, natural jewelry reflections, realistic red carpet materials, and believable professional event lighting.

The final image should look like a **real luxury red carpet photograph captured by a professional fashion photographer**, combining celebrity-event sophistication with contemporary high-fashion editorial aesthetics.

Avoid casual styling, casual clothing, excessive beauty retouching, plastic or airbrushed skin, altered facial identity, changed eye color, changed hair color, redesigned facial features, artificial facial symmetry, harsh shadows, overexposure, excessive glow, excessive HDR, unrealistic body proportions, distorted hands, extra fingers, artificial-looking lace, or an overly edited AI-generated appearance.

**Absolute priority:** keep the reference woman's **face, identity, eye color, hair color, and recognizable facial characteristics unchanged** while transforming her into a luxury red carpet editorial portrait.`
  },
  {
    id: 'wedding-kiss-fireworks',
    label: 'Cinematic Wedding Kiss with Epic Fireworks',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Cinematic%20Wedding%20Kiss%20with%20Epic%20Fireworks.jpg',
    prompt: `Create an **epic, romantic, cinematic wedding photograph** using the uploaded bride and groom reference images.

Use the uploaded bride and groom images with **maximum reference strength and absolute identity preservation**. The bride must remain exactly the same person as in her reference image, and the groom must remain exactly the same person as in his reference image. Preserve their facial identities, facial structures, proportions, recognizable features, skin tones, eye characteristics, and overall appearance. Do not blend their identities together, replace their faces, or reinterpret their features. The face similarity to both references must be the highest priority.

The scene takes place outdoors at **night in an open landscape**, with trees visible as dark silhouettes in the distance. The atmosphere is epic, romantic, powerful, emotional, and cinematic, like the climactic final scene of a major wedding film.

The couple stands prominently in the foreground while **massive fireworks dominate the night sky behind them**. Use a dramatic **low-angle camera perspective looking slightly upward**, making the fireworks appear enormous and spectacular while keeping the couple as the emotional focal point.

The bride is leaning naturally into an intimate kiss with the groom. One of her hands rests gently against the groom's face. Her posture should communicate genuine emotion and complete immersion in the moment. She wears **the exact same wedding dress shown in her reference image**, preserving its design, silhouette, material, and distinctive details. The fabric should have a subtle realistic sheen that catches the changing light from the fireworks.

The groom holds the bride firmly but naturally around her waist. His posture should feel protective and intimate without appearing stiff or posed. His expression and appearance must remain faithful to his reference image.

Create a powerful romantic moment as the couple kisses beneath the fireworks. Their bodies must be naturally aligned, with realistic anatomy, believable physical contact, natural hand placement, and authentic posture.

Fill the sky with **huge, highly detailed fireworks explosions**. Use multiple layers of explosions, intricate particle trails, individual sparks, expanding bursts, and realistic gravity-driven falling particles. The fireworks should feel physically believable and enormous in scale, filling a significant portion of the frame.

Firework bursts should dynamically illuminate the couple from different directions. Treat the fireworks as both **dynamic key light and rim light**, producing intermittent warm highlights across their faces, hair, wedding dress, and clothing. Include subtle drifting smoke between the fireworks and the couple to create atmospheric depth and realistic light diffusion.

Simulate a professional cinematic camera using an **ARRI Alexa Mini LF with a 35mm cinematic lens at approximately f/2.0**. Maintain sharp focus on the couple while preserving a dynamic, detailed sky. Use realistic cinematic depth of field without excessively blurring the fireworks.

Create strong visual contrast between the **bright warm-golden fireworks and the deep blue-black night sky**. Use a cinematic color grade dominated by deep blues with warm golden highlights from the explosions. Maintain high dynamic range while preserving realistic shadow detail.

The foreground should emphasize the couple's emotional connection, realistic facial details, wedding attire, and physical interaction. The background should be dominated by spectacular fireworks filling the sky, with distant trees appearing as subtle silhouettes.

The image should feel like a **premium epic cinematic film still from a romantic wedding movie**, combining the scale of a spectacular celebration with the intimacy of a genuine kiss.

Prioritize maximum photorealism. The fireworks must obey realistic physical behavior, including believable explosion patterns, particle trajectories, gravity, smoke movement, illumination, and atmospheric scattering. The wedding dress and other fabrics must react naturally to the intense flashes of light.

Preserve realistic human anatomy, facial proportions, hands, fingers, body alignment, clothing structure, fabric folds, hair detail, skin texture, and natural physical contact between the couple.

The final image should have **ultra-high-resolution detail**, cinematic sharpness, realistic skin texture, authentic lens characteristics, physically believable lighting, and absolutely no artificial CGI appearance.

Avoid small or weak fireworks, insufficient illumination, blurry faces, flat night lighting, lack of depth, fake-looking sparks, repetitive firework patterns, distorted silhouettes, incorrect anatomy, altered identities, face blending, duplicated limbs, malformed hands, extra fingers, distorted wedding clothing, artificial skin, plastic faces, excessive HDR, cartoon rendering, CGI appearance, unrealistic smoke, text, logos, or watermarks.

**Absolute priority:** the bride and groom must remain the **exact individuals shown in the uploaded reference images**, while the scene is transformed into an enormous, cinematic nighttime wedding kiss surrounded by spectacular fireworks.`
  },
  {
    id: 'film-grain-fashion',
    label: 'Hyper-realistic High-Fashion Portrait with Film Grain',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Hyper-realistic%20High-Fashion%20Portrait%20with%20Film%20Grain.jpg',
    prompt: `Create an **ultra-photorealistic high-fashion film photograph** of a young adult woman with facial characteristics resembling the requested reference, while maintaining a natural and believable appearance.

She has a **detailed curly dark chestnut-brown updo**, with numerous loose ringlets naturally framing parts of her face. Her hair should have realistic individual strands, volume, texture, and subtle imperfections.

Give her realistic **dewy skin with clearly visible natural pores and fine skin texture**. Her expression is cheeky, playful, and slightly teasing, with one hand positioned naturally near her mouth. She wears sophisticated **mauve-toned lipstick** that complements her complexion.

She has a slender physique with realistic anatomy and natural body proportions. Preserve any distinctive tattoos visible in the reference, including subtle rib-cage and inner-arm tattoos, with accurate placement and realistic ink texture.

Her outfit consists of a **beige faux-fur crop top with a matching mini skirt**, paired with elegant **white fingerless opera gloves**. The faux-fur material should have highly detailed fibers and realistic tactile texture. The gloves should show believable fabric construction, folds, and stitching.

Add **large flat disc earrings** as the primary jewelry, with realistic material reflections and natural movement.

Set the photograph against a **plain white studio wall** with a minimalist white background. Include a clearly visible but tasteful **film-grain texture** throughout the image. The background should contain a strong directional shadow created by the studio lighting, adding depth while keeping the environment minimal.

Use an **asymmetrical, playful stance**. One hand should be positioned near the mouth or cheek while the other rests naturally near the hip. Keep the shoulders and body slightly asymmetrical for an effortless fashion-editorial pose.

Capture the subject from an **eye-level medium-full perspective**, showing enough of the body and outfit to clearly establish the complete styling while maintaining emphasis on the face and pose.

Use **directional hard studio lighting** with high contrast and clearly defined shadows. The lighting should create dramatic highlights across the dewy skin, textured faux fur, gloves, and jewelry. Maintain a gritty cinematic atmosphere without introducing artificial glow.

Use a neutral **beige-and-white color palette**, with the beige clothing contrasting against the clean white studio environment.

Simulate an **ultra-photorealistic RAW film photograph** captured with an **85mm lens at approximately f/5.6**. Maintain realistic optical compression, natural depth of field, crisp facial detail, and authentic film characteristics.

The final photograph should have an **8K-quality appearance**, extremely detailed skin and hair, pronounced but realistic film grain, physically believable reflections, hyper-realistic material textures, and an authentic high-fashion film-photography aesthetic.

Prioritize realistic human anatomy, natural facial proportions, authentic skin pores, individual hair strands, realistic faux-fur fibers, accurate glove texture, believable jewelry reflections, natural shadows, and genuine analog-film characteristics.

Avoid plastic skin, excessive beauty retouching, artificial smoothing, cartoon rendering, CGI appearance, unrealistic anatomy, distorted hands, extra fingers, warped jewelry, fake hair, excessive HDR, artificial glow, overly clean digital rendering, flat lighting, distracting backgrounds, text, logos, and watermarks.

The final result should resemble a **gritty luxury fashion editorial photographed on high-quality film**, combining playful attitude, cinematic lighting, tactile textures, and authentic photographic imperfections.`
  },
  {
    id: 'giant-filmmaker-miniature',
    label: 'Giant Filmmaker and Miniature Model in Studio',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Giant%20Filmmaker%20and%20Miniature%20Model%20in%20Studio.jpg',
    prompt: `A hyper-realistic cinematic scene of a giant woman filmmaker carefully adjusting a miniature vintage film camera on a tripod, inside a professional studio setup. A tiny elegant woman in a flowing pastel blue dress stands beside the camera like a model on set. Surrounding them are detailed studio lights, softboxes, film reels, cables, and a clapperboard. The giant woman has soft natural makeup, blonde hair tied back, and an intense focused expression. Dramatic soft lighting, shallow depth of field, ultra-detailed textures, 8K, photorealistic, cinematic composition, studio photography, volumetric lighting.`
  },
  {
    id: 'smiling-woman-gym',
    label: 'Smiling Woman in Gym, Cinematic Portrait',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Smiling%20Woman%20in%20Gym,%20Cinematic%20Portrait.jpg',
    prompt: `A smiling young woman with fair skin and freckles posing in a gym. She is sitting sideways on a workout bench, leaning back with one arm raised behind her head. She wears a fitted brown athletic bodysuit with thin straps and a brown baseball cap with the word '{argument name="cap text" default="SADIE"}' on it. Her expression is relaxed and cheerful, eyes slightly closed. The background shows a dimly lit gym environment with blurred workout equipment. Soft lighting highlights her skin and creates a cinematic, shallow depth-of-field effect.", "style": "photorealistic, cinematic lighting, shallow depth of field", "camera": "portrait shot, medium close-up, slight angle", "environment": "modern indoor gym, blurred background", "mood": "relaxed, confident, warm`
  },
  {
    id: 'miniature-man-bathtub',
    label: 'Miniature Man in Bathtub Held by Giant Hand',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Miniature%20Man%20in%20Bathtub%20Held%20by%20Giant%20Hand.png',
    prompt: `Use the attached reference image for the face.
A miniature man (use the face from the reference photo) is soaking in a small, white, rectangular bathtub with sharp, pointed corners, filled with water and plenty of soap suds. He appears surprised with a tense expression, holding his knees with both hands. His hair is styled exactly as in the reference photo. His body is folded narrowly to fit the bathtub, with his knees bent and his feet together.
The bathtub is held by a large hand from below, gripping the outside with curved fingers while the palm supports it.
The perspective is a top view with the bathtub in a vertical position, showing almost the entire body from head to toe, and clearly showing the hands holding the tub. The background is a plain dark gray, with dramatic lighting that brings out the realistic details of the skin, soap suds, and hand texture.
Aspect ratio: 3:4`
  },
  {
    id: 'man-dolphin-water',
    label: 'Man and Dolphin in Turquoise Water',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Man%20and%20Dolphin%20in%20Turquoise%20Water.jpg',
    prompt: `Take a photo of me, without changing my features, taken in the water, showing a man and a dolphin.
The man:
​100% identical to the attached image and with wet hair, he is looking at the camera.
​He is wearing what appears to be a life jacket and beach trunks.
​He is hugging the dolphin, or with his head against his.
The Dolphin:
​The dolphin's head is very close to the man, floating on the surface of the water. He appears to be looking directly at the camera or the man
Your skin is smooth and gray.
​The Environment:
​The water is incredibly clear and a brilliant turquoise, suggesting a tropical or Caribbean environment.
​The background, slightly out of focus, shows some vegetation and structures (perhaps piers or buildings) on land.
​The day is sunny, and the intense light contributes to the brightness and clarity of the scene.
​The photo conveys a feeling of joy, adventure and close interaction with marine life in a paradisiacal environment.`
  },
  {
    id: 'navy-suit-portrait',
    label: 'Business Portrait in Navy Suit with Cinematic Lighting',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Business%20Portrait%20in%20Navy%20Suit%20with%20Cinematic%20Lighting.png',
    prompt: `Create a picture of business woman/man of the uploaded person wearing a deep navy blue slim-fit suit with a crisp white shirt and patterned tie, positioned against a smooth monochromatic navy background. Soft cinematic side lighting, dramatic shadows, wide-angle framing, full body shot.
Do not change the person's face, keep 100% same.`
  },
  {
    id: 'hogwarts-gryffindor',
    label: 'Hogwarts-Style Photoshoot with Gryffindor Robe',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Hogwarts-Style%20Photoshoot%20with%20Gryffindor%20Robe.png',
    prompt: `USE UPLOADED PHOTO AS REFERENCE.HOGWARTS-STYLEPHOTOSHOOT. THE GIRL IS POSING, IN A BLACK ROBE, THE UNDERSIDE OF THE ROBE IS RED, A WHITE COLLAR AND A TIED TIE OF GRYFFINDOR COLOR ARE VISIBLE. HER HAIR IS LOOSE, A DILAPIDATED, OLD BOOK IS PRESSED TO HER BODY IN HER HANDS. HE HOLDS A MAGIC WAND IN ONE HAND. A WHITE OWL SITS ON THE SHOULDER, THE BACKGROUND IS AN OLD STONE WALL, THE BACKGROUND IS SLAY. THEMATIC PHOTO SESSION. DETAILING, HIGH QUALITY.PORTRAIT.`
  },
  {
    id: 'gallery-oil-painting',
    label: 'Cinematic Gallery Portrait with Oil Painting',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Cinematic%20Gallery%20Portrait%20with%20Oil%20Painting.jpg',
    prompt: `Create a cinematic scene in a modern art gallery using the uploaded image - keep every facial feature exactly as in the photo. On a dark blue wall hangs a large oil painting of the same person, realistic and expressive with textured brushstrokes and muted colors.`
  },
  {
    id: 'christmas-box-collage',
    label: 'Christmas Box Challenge Photo Collage',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Christmas%20Box%20Challenge%20Photo%20Collage.jpg',
    prompt: `Use the face without any  change. A high-quality 2x2 creative photo collage of a young woman with long wavy black hair , posing inside cardboard boxes for a Christmas-themed challenge. She wears a cream, red, and green Fair Isle knit sweater.
Layout & Interaction (Crucial):The right side features a continuous action across two panels. Red wine is poured from the top-right panel and flows vertically down into the bottom-right panel.
Panel Details:

Top Left: She blows artificial snow from her palms towards the camera.
Bottom Left: She holds glowing fairy lights and a red bauble, smiling warmly.
Top Right: She leans on the box edge, holding a wine bottle, pouring red wine downwards so the liquid stream exits the bottom of this frame.
Bottom Right: She is positioned below, holding a wine glass that catches the stream of wine pouring down from the panel above. She is looking up, watching the wine flow into her glass.

Style: Creative box challenge photography, seamless cross-panel interaction, festive mood, soft studio lighting, ultra-realistic textures.`
  },
  {
    id: 'rooftop-golden-hour',
    label: 'Cinematic Rooftop Portrait at Golden Hour',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Cinematic%20Rooftop%20Portrait%20at%20Golden%20Hour.jpg',
    prompt: `"Award-winning cinematic portrait of a charismatic man perched confidently on the edge of a weathered concrete rooftop ledge, his legs dangling freely into the urban abyss below. Golden hour sunlight filters through the cityscape, casting dramatic rim lighting around his silhouette while creating a warm amber glow on his rich brown skin. He sports vintage aviator sunglasses that reflect the sprawling metropolis, a perfectly worn cognac leather jacket over a crisp white henley that catches the breeze. His tousled curls dance in the wind as he flashes an enigmatic, knowing smile directly at the camera. Behind him, a forest of glass and steel skyscrapers stretches toward infinity, their surfaces gleaming like mirrors in the late afternoon sun. Shot with a 85mm lens at f/1.8 for dreamy bokeh, the composition follows the rule of thirds with the subject positioned dynamically against the geometric urban landscape. The color grading emphasizes warm oranges and deep teals, creating that coveted cinematic contrast. Captured from a low angle to enhance his commanding presence against the dramatic sky filled with wispy clouds."`
  },
  {
    id: 'luxury-tennis-grid',
    label: 'Luxury Tennis Editorial 2x2 Grid with Elegant Woman',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Luxury%20Tennis%20Editorial%202x2%20Grid%20with%20Elegant%20Woman.jpg',
    prompt: `Create a **photorealistic luxury tennis fashion editorial collage** featuring the same elegant athletic woman across all four panels.

Use the provided reference image with **very high reference strength** and maintain extremely consistent facial identity across every panel. The woman must clearly remain the same person in all four images. Preserve her recognizable facial structure, facial proportions, skin characteristics, eye appearance, and overall identity. Do not blend identities or create different versions of her face between panels.

Create a single **4:5 portrait image** divided into a clean **2×2 editorial grid**, consisting of four distinct panels arranged in two rows and two columns. Use thin gutters between panels, with no outer border. Maintain maximum identity consistency, while allowing each panel to have its own pose, styling variation, and composition.

The overall visual aesthetic should combine **luxury sportswear with high-end fashion campaign photography**. The image should feel like a premium tennis fashion campaign photographed for an upscale summer editorial.

The woman has long, softly styled hair or a sleek sporty ponytail depending on the pose. Her hair should remain polished, feminine, natural, and consistent with her identity. Her makeup is refined sporty beauty: clean glowing skin, subtle bronzed contour, glossy natural lips, and a fresh polished complexion.

Her physique should appear **lean and athletic with elegant feminine proportions**, while maintaining completely natural human anatomy and realistic posture.

### Panel 1

Show the woman wearing a **soft pastel-blue luxury tennis dress** with a fitted bodice and subtly pleated skirt. The garment should use refined premium fabric with realistic texture and elegant construction.

Give her a sophisticated tennis pose, such as standing naturally on the court while holding a premium tennis racket. The pose should feel graceful, confident, and editorial rather than like a generic sports advertisement.

### Panel 2

Show the same woman wearing a **fresh matcha-green tennis set**, consisting of a fitted athletic top and pleated mini skirt. The styling should be modern, sculpted, feminine, and premium.

Use a distinct dynamic pose, such as preparing for a serve or standing confidently with the racket positioned naturally. Maintain realistic anatomy and believable tennis posture.

### Panel 3

Show the same woman in an **icy aqua-blue sleeveless tennis outfit** with elegant waist definition and elevated sporty-chic styling.

Use another clearly different editorial pose, such as walking across the court or casually holding a tennis racket. The composition should emphasize the silhouette of the outfit while maintaining the same recognizable face.

### Panel 4

Show the same woman wearing a **light sage-green premium tennis dress or coordinated tennis set** with a feminine, polished design.

Give this panel a distinct relaxed fashion pose, perhaps standing near the court with a premium tennis racket or casually holding a tennis ball. The pose should communicate effortless luxury and summer sophistication.

Across the four panels, use **clean luxury white tennis shoes** and minimal delicate jewelry. One panel may optionally include elegant sunglasses or a refined tennis cap, but these accessories must not appear in every panel. Include a premium tennis racket naturally in selected poses. Use a tennis ball in only one or two panels.

Set the entire editorial on a **luxury outdoor tennis court under clean natural sunlight**. Use an upscale clay court or pastel-toned court aesthetic with the atmosphere of an exclusive resort tennis club.

The background should remain **minimal, elegant, and uncluttered**, featuring subtle greenery, refined architectural or court lines, and clean negative space. Avoid distracting spectators, excessive equipment, advertising, or busy backgrounds.

The overall mood should feel **fresh, stylish, sporty, feminine, luxurious, expensive, and distinctly summery**.

Use bright natural sunlight with clean editorial contrast. Maintain realistic highlights on the woman's skin, hair, clothing, racket, and court surface. Use a **fresh soft-summer color grade**, keeping the blue and green outfits vibrant but sophisticated rather than excessively saturated.

Give the image an **editorial-crisp photographic appearance**, subtle film grain, realistic dynamic range, natural skin texture, and highly detailed fabric rendering.

Each panel must have a **distinct pose and composition**, but the woman's identity must remain extremely consistent. The four images should look as though they were photographed during the same luxury tennis campaign on the same day, with coherent lighting, styling, camera quality, and visual language.

Prioritize photorealism: accurate facial identity, realistic skin pores, natural hair strands, believable anatomy, realistic hands and fingers, authentic tennis clothing construction, detailed pleats, realistic fabric behavior, physically accurate tennis rackets and balls, natural shadows, and genuine outdoor sunlight.

Avoid inconsistent faces between panels, identity drift, facial blending, different-looking women, distorted anatomy, malformed hands, extra fingers, unrealistic tennis equipment, duplicated objects, plastic skin, excessive beauty retouching, artificial HDR, CGI appearance, excessive saturation, harsh shadows, cluttered backgrounds, text, logos, watermarks, or an artificial AI-generated appearance.

The final result should look like a **single premium 2×2 luxury tennis campaign contact sheet**, with four distinct fashion photographs of the same woman, combining high-end resort fashion, athletic elegance, and sophisticated summer editorial photography.`
  },
  {
    id: 'double-exposure-football',
    label: 'Dramatic Double Exposure Football Player Portrait',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Dramatic%20Double%20Exposure%20Football%20Player%20Portrait.jpg',
    prompt: `A dramatic double exposure portrait of a professional football player, large side-profile face in black and white with intense expression, combined with a smaller full-body action shot of the same player running in a red jersey, dynamic motion, dust and smoke particles blending the layers, high contrast lighting, textured grain, minimal clean background, editorial sports poster style, ultra-detailed, sharp focus, cinematic composition, 8K resolution.`
  },
  {
    id: 'photo-hakimi',
    label: 'Photo with Achraf Hakimi - Morocco & PSG',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Photo%20with%20Achraf%20Hakimi%20-%20Morocco%20&%20PSG.webp',
    prompt: `A person in the uploaded image, with the same face, identity, age, skin tone, and expression, is standing at the boundary line of a packed stadium beside Moroccan defender Achraf Hakimi.

The fan is wearing a Morocco red national jersey with green trim and smiling proudly. Hakimi stands next to them in his Morocco red home jersey, short stylish dark hair with a trimmed beard, confident bright smile. The background shows a green stadium pitch, floodlights, cheering Moroccan fans in red and green, Moroccan flags fluttering.

Camera: professional sports portrait, eye-level composition, realistic stadium lighting, sharp facial detail, natural skin texture, true-to-life body proportions, DSLR quality, 85mm lens.

Avoid: changed face, extra fingers, unreadable jersey text, fake logos, over-smoothed skin, cartoon look, bad anatomy, watermark, text artifacts.`
  },
  {
    id: 'ipl-fan-stadium',
    label: 'IPL Fan Cricket Stadium',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/IPL%20Fan%20Cricket%20Stadium%20Photo%20Prompt.webp',
    prompt: `A person in the uploaded image, with the same face, age, skin tone, expression, and natural facial details, is standing inside a packed IPL cricket stadium during a night match.

The person is wearing a stylish cricket fan jersey, holding a cricket bat in one hand and a team scarf in the other. The stadium is full of cheering fans, bright floodlights, colorful flags, confetti, green pitch, and a premium Indian Premier League match atmosphere. The person should look like they are part of a real post-match celebration.

Camera: realistic DSLR sports photography, eye-level medium shot, 35mm lens, sharp focus on the face, natural body proportions, realistic hands, vibrant stadium colors.

Avoid: changed face, unreadable text, fake logos, extra fingers, distorted bat, waxy skin, cartoon style, bad anatomy, watermark.`
  },
  {
    id: 'photo-ronaldo',
    label: 'Photo with Cristiano Ronaldo In Ground',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Photo%20with%20Cristiano%20Ronaldo%20In%20Ground.webp',
    prompt: `A handsome man in the uploaded image (100% matching face) is standing in the middle of Real Madrid stadium, surrounded by a full crowd and bright green grass. He is wearing the Real Madrid jersey and dark blue jeans, smiling while wrapping his arm around Cristiano Ronaldo beside him. They both are holding the same Real Madrid's jersey, showing Ronaldo's name and number 7 on the back. The camera composition is eye-level, with nighttime stadium lighting and spotlights. The style is high-quality realism.`
  },
  {
    id: 'luxury-3d-sports-poster',
    label: 'Luxury 3D Sports Editorial Poster',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Style%20%20Luxury%203D%20Sports%20Editorial%20Poster.jpg',
    prompt: `Professional luxury football poster, 4:5 ratio. Entire frame filled with a premium luxury paper textured wall. Large number "[Player Jersey Number]" precisely carved in the wall with visible depth and realistic inner shadows. Inside the number: colorful balloons, golden confetti, subtle white flowers, elegant celebration arrangement, premium styling. [Name Of Player] with preserved reference facial features, wearing [National Team Name] national team jersey number [Player Jersey Number], celebrating naturally with football. Face, shoulder, one hand and one foot extend outside the number creating a realistic 3D effect. Dramatic cinematic golden sunlight from one side, sharp rim light, photorealistic skin, premium studio photography, ultra realistic, sharp focus. Typography on wall: [Name Of Player], [National Team Name], [Your Caption Here]. Clean minimalist layout, luxury sports magazine cover aesthetic, high end art direction, realistic shadows, natural colors, no fake lighting, no AI artifacts.`
  },
  {
    id: 'dual-exposure-tribute',
    label: 'Dual-Exposure Photo-Grid Sports Tribute Poster',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Style%20Dual-Exposure%20Photo-Grid%20Sports%20Tribute%20Poster.jpg',
    prompt: `[PERSON NAME].
Act as a high-end sports graphic designer creating a conceptual tribute poster. The style is a complex "dual exposure photo-grid composite" with mixed-media textures.
CENTRAL STRUCTURE (THE VESSEL):
The central focus is a large-scale, high-contrast black and white portrait silhouette of [PERSON NAME]. This main portrait acts as the container.
THE GRID FILL & TEXTURES (MIXED MEDIA):
The interior of the silhouette is populated by a dense "photo mosaic grid" of action shots from the person's career.
CRITICAL TEXTURE INSTRUCTION: Do not just paste flat photos. Apply artistic textures to various grid cells to create a tactile, collage feel. Use effects like:
Halftone Dots: Comic-book style raster patterns on some cells.
Fabric/Embroidery: Subtle thread or canvas textures suggesting a jersey or patch.
Film Grain: Heavy noise on specific high-contrast action shots.
COLOR STRATEGY:
The base is Monochrome B&W. Use selective color overlays (relevant to the team/flag) ONLY on specific grid cells to create a rhythm.
TYPOGRAPHY & BRANDING (STRICT MICRO-SCALING):
Top Left (The Name): Write "[PERSON NAME]" strictly using the font Inter Semibold.
Kerning: Tight negative kerning (-4%).
Size: SMALL and discreet. It must occupy MAXIMUM 20% of the canvas width. Do NOT make it large or loud.
Top Right (The Symbol): Place the primary logo (Team/Brand/Flag).
Size: VERY SMALL. It must occupy MAXIMUM 10% of the canvas width.
COMPOSITION & BACKGROUND:
Background: Off-white or light grey with a visible high-quality paper or concrete texture. It should not be flat digital white.
Alignment: Center the figure perfectly. Maintain wide negative space around the object.`
  },
  {
    id: 'luxury-3d-birthday',
    label: 'Luxury 3D Birthday Editorial Poster',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Luxury%203D%20Birthday%20Editorial%20Poster.webp',
    prompt: `Professional luxury birthday poster, 3:4 ratio. Entire frame filled with a premium off white luxury paper textured wall. Large number “2” precisely carved in the wall with visible depth and realistic inner shadows. Inside the number: soft pink and pink balloons, subtle white flowers, elegant bouquet arrangement, premium celebration styling. A happy 2 year old child with preserved reference facial features, wearing a milky white T shirt and pink denim overalls, laughing naturally. Face, shoulder, one hand and one foot extend outside the number creating a realistic 3D effect. Warm cinematic sunlight from one side, soft rim light, photorealistic skin, premium studio photography, ultra realistic, sharp focus. Typography on wall: MUNONYE, CHAPTER 2, 365 MORE DAYS OF WONDER. Clean minimalist layout, luxury magazine cover aesthetic, high end art direction, realistic shadows, natural colors, no tree shadows, no fake lighting, no AI artifacts.`
  },
  {
    id: '2000s-paparazzi',
    label: '2000s Paparazzi Tabloid Editorial Photography',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/2000s%20Paparazzi%20Tabloid%20Editorial%20Photography.jpg',
    prompt: `Paparazzi-style extreme close-up photo of a woman with striking facial features, caught off-guard while turning toward the camera. Face and shoulders only, shot from a low angle. Strong harsh on-camera flash, grainy high-ISO, raw candid street-photography feel. Background shows a crowded scene with motion blur (Paris Fashion Week atmosphere). Intense, spontaneous energy, imperfect and real. She is wearing a school uniform. Ultra-realistic, cinematic realism, high detail skin texture, slight lens distortion.

Camera style: “35mm paparazzi lens, f/2.8, flash blown highlights”
Look: “2000s tabloid photo aesthetic”
Quality: “sharp focus on face, background heavily blurred and streaked”`
  },
  {
    id: 'fiery-editorial-studio',
    label: 'Luxury Fashion Advertising Portrait Fiery Editorial Studio',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Luxury%20Fashion%20Advertising%20Portrait%20Fiery%20Editorial%20Studio.jpg',
    prompt: `Ultra-realistic studio portrait photography, confident fashion model wearing a plain black polo shirt, waist-up composition, looking slightly upward and away from camera, strong cinematic expression, vibrant fiery orange-to-red gradient background, intense golden rim light glowing around hair and shoulders, dramatic backlighting, soft beauty key light on face, high contrast lighting, flawless skin texture, sharp facial details, luxury commercial advertising style, premium apparel campaign, clean minimal composition, warm color grading, professional studio setup, shallow depth of field, 85mm lens, f/2.0, ultra-detailed, HDR, photorealistic, magazine-quality, symmetrical framing, bold and powerful mood, high-end fashion editorial, 8K resolution.

Negative Prompt:

blurry, low resolution, noisy image, overexposed highlights, underexposed shadows, distorted face, extra limbs, bad anatomy, duplicate features, watermark, logo, text, cropped head, messy background, unrealistic skin, cartoon, painting, CGI, oversaturated colors, motion blur, out of focus, poor lighting.`
  },
  {
    id: 'video-detecteur-priver',
    label: 'Detecteur Priver',
    category: 'video',
    kind: 'video',
    image:
      'https://ik.imagekit.io/big9hcdtmk/video%20gen/detecteur%20priver.mp4',
    poster:
      'https://ik.imagekit.io/big9hcdtmk/video%20gen/detecteur%20priver.mp4/ik-thumbnail.jpg',
    prompt: `Un détective privé fatigué, vêtu d'un manteau en laine sombre, sort d'une étroite porte d'hôtel sous une pluie battante de minuit, s'arrête sous un panneau rouge clignotant, puis regarde la rue déserte ; travelling avant lent en contre-plongée, reflets sur le pavé mouillé, ombres profondes, couleurs néo-noir maîtrisées, pluie et mouvements du manteau réalistes, pas de secousse soudaine de caméra.`
  },
  {
    id: 'video-voiture-blue',
    label: 'Voiture Blue',
    category: 'video',
    kind: 'video',
    image: 'https://ik.imagekit.io/big9hcdtmk/video%20gen/voiture%20blue.mp4',
    poster:
      'https://ik.imagekit.io/big9hcdtmk/video%20gen/voiture%20blue.mp4/ik-thumbnail.jpg',
    prompt: `blue and white formula one racing car parked on a wet track at sunset, glowing orange sparks flying from the floor against the side, grandstands filled with spectators in the background, cinematic lighting, realistic details`
  },
  {
    id: 'video-transition-vertical',
    label: 'Transition Vertical',
    category: 'video',
    kind: 'video',
    image:
      'https://ik.imagekit.io/big9hcdtmk/video%20gen/transition%20vertical.mp4',
    poster:
      'https://ik.imagekit.io/big9hcdtmk/video%20gen/transition%20vertical.mp4/ik-thumbnail.jpg',
    prompt: `Écran partagé vertical : le même petit salon commence simple à gauche et se transforme en espace chaleureux et décoré à droite à mesure que les meubles et l'éclairage changent par étapes contrôlées ; caméra fixe, transitions rapides mais fluides, éclairage lumineux de style publicité lifestyle, géométrie de la pièce identique.`
  },
  {
    id: 'video-3d-pixar',
    label: '3D Pixar',
    category: 'video',
    kind: 'video',
    image: 'https://ik.imagekit.io/big9hcdtmk/video%20gen/3D%20Pixar.mp4',
    poster:
      'https://ik.imagekit.io/big9hcdtmk/video%20gen/3D%20Pixar.mp4/ik-thumbnail.jpg',
    prompt: `A vibrant 3D Pixar-style animated video of a cute little red fox wearing a tiny blue backpack, happily skipping along a sunlit forest path. Golden hour lighting, soft shadows, cheerful mood. Smooth camera tracking shot following the fox from the side, dynamic movement, 4k resolution, high quality.`
  },
  {
    id: 'video-breathtaking-2d',
    label: 'A Breathtaking 2D',
    category: 'video',
    kind: 'video',
    image:
      'https://ik.imagekit.io/big9hcdtmk/video%20gen/A%20Breathtaking%202D.mp4',
    poster:
      'https://ik.imagekit.io/big9hcdtmk/video%20gen/A%20Breathtaking%202D.mp4/ik-thumbnail.jpg',
    prompt: `A breathtaking 2D hand-drawn Ghibli-style animation. A young girl with short brown hair stands on a grassy hill at night, holding a glowing magical lantern. Dozens of glowing fireflies rise into the dark starry sky around her. Soft wind blowing her dress and hair, cinematic lighting, whimsical and emotional atmosphere. Slow camera zoom-out, masterpiece, high frame rate`
  }
]

/**
 * The 5 newest cards (ImageKit folder "5 NEW"): always displayed FIRST in
 * the grid, before the mixed catalog below.
 */
export const OFFICIAL_NEW_PRESETS: OfficialPreset[] = [
  {
    id: 'new-salle-de-sport',
    label: 'Salle de Sport',
    category: 'generate',
    kind: 'image',
    image: 'https://ik.imagekit.io/big9hcdtmk/5%20NEW/Salle%20de%20Sport.jpg',
    prompt: `Ultra-realistic editorial photography, 8K UHD, ultra-detailed professional fitness photography. Vertical 1:2 composition.

A {argument name="subject identity" default="21-year-old Indonesian woman"} inside a luxurious high-end fitness gym. The environment features an elegant modern fitness center with sophisticated mirrored walls, polished metal equipment, matte-black weight racks, reflective rubber flooring, and subtle ambient LED accents. The background has a soft cinematic bokeh effect that creates strong depth separation while preserving subtle, recognizable gym shapes. The atmosphere is clean, premium, athletic, energetic, and styled like a professional fitness photoshoot, with a shallow depth of field and smooth background blur.

The subject has an athletic and toned physique with natural muscle definition. She has a warm medium-tan Indonesian complexion with a healthy natural glow and visible realistic skin micro-texture. Realistic beads of sweat are visible on her forehead, clavicles, shoulders, and upper chest after an intense workout. Her facial anatomy is natural, with symmetrical features and realistic bone structure. She has a focused, determined expression while lifting weights.

Her hair is dark brown, styled in an effortless messy bun, with a few loose strands naturally framing her face. Some strands are slightly damp from sweat and gently adhere to her temples.

Maintain 1:1 anatomical accuracy of the facial structure. Do not alter the skeletal structure or natural chest proportions. Preserve realistic human anatomy and natural body proportions without exaggeration.

She is wearing a premium athletic bodysuit made from high-performance stretch fabric with subtle compression. The fitted design naturally emphasizes her athletic physique. The fabric has a slight sheen that catches the gym lighting, with realistic folds, tension lines, and material texture. The overall clothing style is minimalist luxury sportswear.

She is actively lifting weights during a workout. Capture a dynamic full-body medium shot showing the movement of lifting a dumbbell or barbell. Her posture is strong and athletic, with visibly engaged muscles and natural physical effort. Include subtle movement tension in the arms and shoulders while maintaining realistic anatomy.

Shot with a professional full-frame DSLR or mirrorless camera using an 85mm portrait lens, f/2.0 aperture, ISO 100, and 1/500s shutter speed. The face and body should be sharply focused with realistic professional photographic detail, natural lighting, accurate skin texture, realistic sweat, physically accurate shadows, cinematic depth, and premium editorial fitness photography quality.`
  },
  {
    id: 'new-travel-lifestyle',
    label: 'Photorealistic Lifestyle Travel Photography',
    category: 'generate',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/5%20NEW/Photorealistic%20Lifestyle%20Travel%20Photography.jpg',
    prompt: `Photorealistic premium travel lifestyle photography, cozy soft aesthetic, natural candid moment, warm and muted color palette, soft ambient cabin lighting, realistic natural skin tones, subtle cinematic atmosphere, shallow depth of field, 50mm lens, eye-level composition, slightly close framing, highly detailed textures, clean modern interior, intimate and relaxed mood, editorial-grade photography, ultra-realistic, 4K detail.`
  },
  {
    id: 'new-iphone-selfie',
    label: 'Intimate Low-Light iPhone Selfie Realism',
    category: 'generate',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/5%20NEW/Intimate%20Low-Light%20iPhone%20Selfie%20Realism.jpg',
    prompt: `Ultra-photorealistic low-light iPhone selfie photography, intimate late-night bathroom realism, authentic smartphone camera aesthetic, warm vanity mirror lighting, subtle soft grain, natural skin texture with visible pores, realistic imperfect details, cozy humid atmosphere, candid unposed lifestyle photography, 24mm wide-angle perspective, slightly elevated selfie angle, vertical 9:16 composition, natural warm muted colors, soft atmospheric highlights, realistic shadows, genuine everyday moment, no studio lighting, no professional photoshoot look, no artificial skin smoothing, highly detailed 8K photographic realism.`
  },
  {
    id: 'new-cinematic-urban-3d',
    label: 'Cinematic Urban Realism × 3D Cartoon Character',
    category: 'generate',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/5%20NEW/Cinematic%20Urban%20Realism%20%C3%97%203D%20Cartoon%20Character.jpg',
    prompt: `Ultra-hyperrealistic cinematic urban photography, premium DSLR aesthetic, mixed-media composition combining photorealistic human photography with a cute stylized 3D cartoon/chibi character, modern street-fashion editorial aesthetic, natural daylight, soft realistic shadows, cinematic color grading, high dynamic range, realistic skin and clothing textures, 50mm lens look, shallow depth of field, crisp subject focus, modern glass architecture, clean urban environment, sophisticated Instagram lifestyle aesthetic, playful contrast between real life and animated character design, ultra-detailed, photorealistic rendering, premium visual quality, 8K.`
  },
  {
    id: 'new-mountain-action',
    label: 'Cinematic Golden-Hour Mountain Action',
    category: 'generate',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/5%20NEW/Cinematic%20Golden-Hour%20Mountain%20Action.jpg',
    prompt: `Cinematic action sports photography, ultra-realistic mountain adventure aesthetic, dynamic wide-angle low-angle tracking shot, dramatic low perspective, intense golden-hour backlighting, prominent anamorphic-style lens flare from the upper right, high-contrast cinematic color grading, warm golden highlights contrasted with deep teal shadows, natural atmospheric haze, crisp subject focus, intentional motion blur on the road and wheels, subtle analog film grain, high dynamic range, dramatic mountain landscape, energetic sense of speed and movement, premium outdoor editorial photography, immersive cinematic composition, emphasis on camera angle, lighting design and color grading.`
  }
]

/**
 * Mixed display order for the preset grid: the 5 NEW cards first, then
 * the catalog with the 5 video presets interleaved evenly among the 45
 * image presets (one video every 9 images), so videos and photos always
 * appear together in a single grid that never changes with the studio
 * mode. Selecting a card switches the studio to that card's mode.
 */
export const OFFICIAL_PRESETS_MIXED: OfficialPreset[] = (() => {
  const images = OFFICIAL_PRESETS.filter(p => p.kind === 'image')
  const videos = OFFICIAL_PRESETS.filter(p => p.kind === 'video')
  const mixed: OfficialPreset[] = []
  const chunk = Math.ceil(images.length / videos.length)
  images.forEach((preset, i) => {
    mixed.push(preset)
    if ((i + 1) % chunk === 0 && videos.length > 0) {
      const video = videos.shift()
      if (video) mixed.push(video)
    }
  })
  mixed.push(...videos)
  // Manual position swaps (by id): exchange two cards' places in the
  // mixed grid without touching anything else.
  const SWAPS: Array<[string, string]> = [
    ['video-detecteur-priver', 'night-street-flash'],
    ['video-voiture-blue', 'red-metal-door'],
    ['video-3d-pixar', 'christmas-box-collage']
  ]
  for (const [a, b] of SWAPS) {
    const ia = mixed.findIndex(p => p.id === a)
    const ib = mixed.findIndex(p => p.id === b)
    if (ia >= 0 && ib >= 0) {
      const tmp = mixed[ia]
      mixed[ia] = mixed[ib]
      mixed[ib] = tmp
    }
  }
  const ordered = [...OFFICIAL_NEW_PRESETS, ...mixed]
  // Absolute placements (by id, 0-indexed) in the final grid: the DOM
  // order is shared by mobile and desktop, so one index covers both.
  const PLACE_AT: Array<[string, number]> = [['video-detecteur-priver', 5]]
  for (const [id, at] of PLACE_AT) {
    const i = ordered.findIndex(p => p.id === id)
    if (i >= 0) {
      const [card] = ordered.splice(i, 1)
      ordered.splice(Math.min(at, ordered.length), 0, card)
    }
  }
  return ordered
})()
