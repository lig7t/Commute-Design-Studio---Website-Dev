/* ============================================================
   gallery.data.js — the Selected Work gallery's twelve projects.

   Derived from public/images/works/works.json by grouping its entries on
   their `project` field, in order of first appearance. Transcribed as
   static data rather than fetched: the gallery builds its slides
   synchronously at mount, and lib/works.js's loadWorks() is async, so
   importing it here would put a network round trip in front of the pinned
   ScrollTrigger's first measurement. works.json stays the source of record
   — the ids below are a snapshot of it, not a second opinion about it.

   Regenerate after editing works.json (grouping is order-of-first-appearance
   on `project`, so the twelve titles and their order come straight out):

     python3 -c "import json,collections; \
       d=json.load(open('public/images/works/works.json')); \
       g=collections.OrderedDict(); \
       [g.setdefault(e['project'],[]).append(e['id']) for e in d]; \
       [print(k, v) for k,v in g.items()]"

   Twelve projects is load-bearing, not incidental: gallery.css sizes and
   staggers the column with nth-child rules written against twelve slides.
   A thirteenth project in works.json needs those rules revisited.

   Shape:
     { id, title, discipline,
       mainImage,      // thumbnail + Flip preview source
       galleryImages } // the project's remaining images, card right column

   Images are drawn from the shared works folder (public/images/works/full).
   Paths are base-relative strings; asset() in lib/works.js resolves
   them at runtime. They are deliberately NOT static imports — that is why
   the files live in public/, where the bundler copies them through
   untouched instead of hashing them.
   ============================================================ */

const DISCIPLINES = [
  'Interior architecture',
  'Lighting design',
  'Furniture & millwork',
  'Material specification',
];

/* [ project title, [every image id for it, in works.json order] ].

   The first id is the slide thumbnail and the card's hero; the rest fill the
   card's grid. Note that 'Alo Restaurant' has exactly one image in
   works.json, so its galleryImages is empty and its card shows a hero with
   an empty grid beside it. That is what the manifest currently holds, not a
   transcription slip. */
const SOURCES = [
  ["Number's Residence", ['001', '002', '003', '004', '005', '006', '007', '016', '075', '076']],
  ['Alo Restaurant', ['008']],
  ['Oretta King', ['009', '010', '011', '012', '013', '014', '015']],
  ['Oretta Downtown', ['017', '029', '030']],
  ['Aloette', ['018', '041', '042', '043', '044']],
  ['Fort York FX', ['019', '020', '021', '022', '023']],
  ['Oretta Midtown', ['024', '025', '026', '027', '028', '031', '032', '033', '034', '035', '036']],
  ['Alo Private', ['037', '038', '039', '040']],
  [
    'Villa Malaguti',
    // prettier-ignore
    ['045', '046', '047', '048', '049', '050', '051', '052', '053',
     '054', '055', '056', '057', '058', '059', '060', '061'],
  ],
  ["Porzia's", ['062', '063', '064', '065', '066', '067', '068', '069']],
  ['Salon', ['070', '071', '072', '073', '074']],
  ['Oretta', ['077', '078', '079', '080', '081']],
];

const full = (id) => `images/works/full/${id}.webp`;

/* `id` and `discipline` are carried but not currently rendered — the slide
   caption and the card both show `title` alone now. Kept because they are
   part of the documented schema and cost nothing; delete them here and in
   the typedef together if that stops being true. */
/** @type {Array<{id:string,title:string,discipline:string,mainImage:string,galleryImages:string[]}>} */
export const projects = SOURCES.map(([title, ids], i) => ({
  id: String(i + 1).padStart(2, '0'),
  title,
  discipline: DISCIPLINES[i % DISCIPLINES.length],
  mainImage: full(ids[0]),
  galleryImages: ids.slice(1).map(full),
}));

export default projects;
