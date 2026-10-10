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
    prompt: `A stylish young couple sitting casually on a beige carpeted floor during a late-night wedding afterparty, eating pizza together from open boxes. The man wears a black suit with a loosened tie, and the woman wears an elegant short white satin dress. Hard direct camera flash, sharp realistic shadows on the wall, candid imperfect snapshot aesthetic, intimate party mood, 35mm lens, natural skin texture, 8K photorealism.`
  },
  {
    id: 'smartphone-selfie-car',
    label: 'Realistic Smartphone Selfie in a Modern Car',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Realistic%20Smartphone%20Selfie%20in%20a%20Modern%20Car.jpg',
    prompt: `A hyper-photorealistic candid front-facing smartphone selfie of the person in the reference image, sitting in the driver's seat of a modern car during daytime. Holding a phone at arm's length with a natural subtle smile, wearing casual daytime clothes. Soft bright natural sunlight through windshield, realistic car interior reflections, unretouched skin texture with visible pores, genuine phone camera perspective, 8K ultra-realism.`
  },
  {
    id: 'camel-coat-porsche',
    label: 'Man in Camel Coat with Vintage Porsche Targa',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Man%20in%20Camel%20Coat%20with%20Vintage%20Porsche%20Targa.jpg',
    prompt: `Sophisticated editorial photograph of an elegant man standing beside a vintage silver Porsche Targa in a green countryside setting. He wears a tailored camel double-breasted overcoat, unbuttoned white shirt, and cream trousers. Directional golden afternoon sunlight, dramatic sharp shadows, realistic metallic reflections on the car, luxury menswear aesthetic, 85mm portrait lens, tack-sharp focus, cinematic film grain, 8K.`
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
    prompt: `Hyper-realistic portrait of the woman from the reference image in a vibrant outdoor tropical setting under bright sunlight. Wearing a white V-neck bodysuit, denim jeans, and a flowing sheer pink floral kimono. Accessorized with delicate layered necklaces featuring a hamsa charm. Lush green palms and bamboo background, dewy glowing skin texture, high-clarity smartphone HDR aesthetic, crisp natural daylight, 8K.`
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
    prompt: `Playful modern high-fashion close-up portrait of the person from the reference image, wearing a textured vivid orange sleeveless knit top, bright orange hoop earrings, and oval sunglasses with orange lenses resting low on the nose. Messy stylish updo, finger lightly touching lower lip, direct teasing gaze. Clean off-white studio backdrop, soft beauty lighting, ultra-sharp skin texture, 85mm lens, f/2.8, 8K editorial photography.`
  },
  {
    id: 'pisa-selfie',
    label: 'Young Woman Selfie at Piazza del Duomo, Pisa',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Young%20Woman%20Selfie%20at%20Piazza%20del%20Duomo,%20Pisa.jpg',
    prompt: `Spontaneous wide-angle smartphone selfie of a radiant young woman at Piazza del Duomo in Pisa, with the Leaning Tower sharply visible in the background under a blue sky. Wearing a crisp white linen shirt and tortoiseshell sunglasses, smiling warmly with one arm extended toward the lens. Bright natural daylight, clear marble architectural details, authentic unretouched skin texture, vibrant Italian travel aesthetic, 8K.`
  },
  {
    id: 'futuristic-seated-editorial',
    label: 'Futuristic Fashion Editorial with Seated Female Model',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Futuristic%20Fashion%20Editorial%20with%20Seated%20Female%20Model.jpg',
    prompt: `Futuristic fashion editorial portrait of the woman from the reference image, seated in a relaxed confident posture. Wearing an oversized white sweatshirt, cloudy-blue denim cargo jeans, and modern sneakers. Minimalist monochrome sky-blue studio backdrop, soft cinematic glow lighting with subtle realistic shadows, contemporary high-fashion magazine aesthetic, sharp skin and fabric textures, 85mm lens, 8K photorealism.`
  },
  {
    id: 'hair-dye-transformation',
    label: 'Step-by-Step Hair Dye Beauty Transformation Grid',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Step-by-Step%20Hair%20Dye%20Beauty%20Transformation%20Grid.jpg',
    prompt: `Photorealistic 2x2 step-by-step beauty transformation grid of the same woman across four panels: Panel 1 applying rich hair dye cream section by section at home; Panel 2 fresh wet hair after washing; Panel 3 damp hair during blow-drying; Panel 4 final polished voluminous deep auburn-red hair wearing a green satin top. Flattering vanity lighting, consistent facial identity, ultra-sharp hair and skin texture, luxury beauty editorial, 8K.`
  },
  {
    id: 'red-carpet-editorial',
    label: 'High Fashion Red Carpet Editorial Portrait',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/High%20Fashion%20Red%20Carpet%20Editorial%20Portrait.jpg',
    prompt: `High-fashion red carpet editorial full-body photograph of the woman from the reference image at a prestigious evening gala. Confidently posing in a fitted long black lace evening gown with intricate realistic lace texture and elegant statement earrings. Luxury red carpet event backdrop with soft studio illumination, polished glamorous makeup, sharp focus head-to-toe, rich deep contrast, 85mm portrait lens, 8K celebrity realism.`
  },
  {
    id: 'wedding-kiss-fireworks',
    label: 'Cinematic Wedding Kiss with Epic Fireworks',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Cinematic%20Wedding%20Kiss%20with%20Epic%20Fireworks.jpg',
    prompt: `Epic cinematic nighttime wedding photograph of the bride and groom from the reference images, intimately kissing in an open landscape while massive vibrant fireworks explode across the dark sky. The bride in her detailed white gown and the groom in a sharp tuxedo are dynamically lit by warm golden firework sparks and rim light. Dramatic low-angle composition, cinematic color grade, atmospheric smoke, 35mm film still look, 8K photorealism.`
  },
  {
    id: 'film-grain-fashion',
    label: 'Hyper-realistic High-Fashion Portrait with Film Grain',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/image%20edit/Hyper-realistic%20High-Fashion%20Portrait%20with%20Film%20Grain.jpg',
    prompt: `Ultra-photorealistic high-fashion RAW film photograph of a young woman with a curly chestnut updo. Wearing a textured beige faux-fur crop top, matching mini skirt, and white fingerless opera gloves with large disc earrings. Playful pose against a clean white studio wall, hard directional lighting casting sharp shadows, authentic 35mm film grain, dewy skin texture with visible pores, 85mm lens, f/5.6, 8K editorial aesthetic.`
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
    prompt: `A 2x2 luxury tennis fashion editorial collage featuring the same athletic woman across four panels on an upscale resort tennis court. Panel 1 in a pastel-blue tennis dress with racket; Panel 2 in a matcha-green tennis set; Panel 3 in an aqua-blue outfit walking; Panel 4 in a sage-green tennis dress holding a ball. Bright natural summer sunlight, consistent facial identity, clean minimal court background, crisp editorial sports photography, 8K.`
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
    prompt: `Conceptual dual-exposure sports tribute poster. A large high-contrast black-and-white silhouette portrait of the athlete forms the central shape, filled internally with a dense photo mosaic grid of career action shots. Artistic textures of halftone dots, subtle jersey mesh, and film grain across the grid cells, with selective team color accents. Off-white textured paper background, clean minimalist layout, 8K graphic art.`
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
    category: 'edit',
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
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/5%20NEW/Photorealistic%20Lifestyle%20Travel%20Photography.jpg',
    prompt: `Photorealistic premium travel lifestyle photography, cozy soft aesthetic, natural candid moment, warm and muted color palette, soft ambient cabin lighting, realistic natural skin tones, subtle cinematic atmosphere, shallow depth of field, 50mm lens, eye-level composition, slightly close framing, highly detailed textures, clean modern interior, intimate and relaxed mood, editorial-grade photography, ultra-realistic, 4K detail.`
  },
  {
    id: 'new-iphone-selfie',
    label: 'Intimate Low-Light iPhone Selfie Realism',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/5%20NEW/Intimate%20Low-Light%20iPhone%20Selfie%20Realism.jpg',
    prompt: `Ultra-photorealistic low-light iPhone selfie photography, intimate late-night bathroom realism, authentic smartphone camera aesthetic, warm vanity mirror lighting, subtle soft grain, natural skin texture with visible pores, realistic imperfect details, cozy humid atmosphere, candid unposed lifestyle photography, 24mm wide-angle perspective, slightly elevated selfie angle, vertical 9:16 composition, natural warm muted colors, soft atmospheric highlights, realistic shadows, genuine everyday moment, no studio lighting, no professional photoshoot look, no artificial skin smoothing, highly detailed 8K photographic realism.`
  },
  {
    id: 'new-cinematic-urban-3d',
    label: 'Cinematic Urban Realism × 3D Cartoon Character',
    category: 'edit',
    kind: 'image',
    image:
      'https://ik.imagekit.io/big9hcdtmk/5%20NEW/Cinematic%20Urban%20Realism%20%C3%97%203D%20Cartoon%20Character.jpg',
    prompt: `Ultra-hyperrealistic cinematic urban photography, premium DSLR aesthetic, mixed-media composition combining photorealistic human photography with a cute stylized 3D cartoon/chibi character, modern street-fashion editorial aesthetic, natural daylight, soft realistic shadows, cinematic color grading, high dynamic range, realistic skin and clothing textures, 50mm lens look, shallow depth of field, crisp subject focus, modern glass architecture, clean urban environment, sophisticated Instagram lifestyle aesthetic, playful contrast between real life and animated character design, ultra-detailed, photorealistic rendering, premium visual quality, 8K.`
  },
  {
    id: 'new-mountain-action',
    label: 'Cinematic Golden-Hour Mountain Action',
    category: 'edit',
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
