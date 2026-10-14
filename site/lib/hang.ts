// The salon hang in the hero: where each work hangs on the wall. Coordinates
// come from the Paper artboard "C · The Salon Hang" (desktop on a 1440-wide
// wall, mobile on a 390-wide one). A slot holds a box, not a size: whatever
// hangs there is fitted inside it whole.

export type FrameKind = 'gilt' | 'wood' | 'paper';

export interface Placement {
  x: number;
  y: number;
  w: number; // the box the painting is fitted into
  h: number;
  pad: number; // frame moulding
  inner: number; // liner (gilt) or mat (paper)
}

export interface Slot {
  slug: string;
  kind: FrameKind;
  desktop: Placement;
  mobile?: Placement;
}

export const SLOTS: Slot[] = [
  {
    slug: 'monet-water-lily-pond',
    kind: 'gilt',
    desktop: { x: -40, y: 120, w: 250, h: 221, pad: 12, inner: 3 },
    mobile: { x: -40, y: 90, w: 110, h: 97, pad: 7, inner: 0 },
  },
  {
    slug: 'hiroshige-evening-snow-at-kanbara',
    kind: 'paper',
    desktop: { x: -20, y: 410, w: 240, h: 160, pad: 7, inner: 16 },
    mobile: { x: -30, y: 300, w: 110, h: 73, pad: 5, inner: 9 },
  },
  {
    slug: 'renoir-two-sisters',
    kind: 'gilt',
    desktop: { x: 30, y: 660, w: 190, h: 234, pad: 12, inner: 3 },
    mobile: { x: 290, y: 230, w: 90, h: 111, pad: 7, inner: 0 },
  },
  {
    slug: 'caillebotte-paris-street-rainy-day',
    kind: 'wood',
    desktop: { x: 290, y: 150, w: 210, h: 159, pad: 12, inner: 0 },
    mobile: { x: 275, y: 84, w: 130, h: 98, pad: 7, inner: 0 },
  },
  { slug: 'degas-the-millinery-shop', kind: 'gilt', desktop: { x: 310, y: 380, w: 170, h: 153, pad: 10, inner: 3 } },
  {
    slug: 'seurat-a-sunday-on-la-grande-jatte-1884',
    kind: 'gilt',
    desktop: { x: 280, y: 610, w: 220, h: 146, pad: 12, inner: 3 },
    mobile: { x: 30, y: 430, w: 130, h: 87, pad: 7, inner: 0 },
  },
  {
    slug: 'hokusai-the-great-wave-off-kanagawa',
    kind: 'paper',
    desktop: { x: 590, y: 720, w: 220, h: 151, pad: 7, inner: 16 },
    mobile: { x: 230, y: 440, w: 120, h: 82, pad: 5, inner: 9 },
  },
  { slug: 'van-gogh-the-poet-s-garden', kind: 'gilt', desktop: { x: 880, y: 735, w: 150, h: 119, pad: 11, inner: 3 } },
  { slug: 'monet-stacks-of-wheat', kind: 'gilt', desktop: { x: 1075, y: 100, w: 210, h: 135, pad: 10, inner: 3 } },
  { slug: 'cassatt-on-a-balcony', kind: 'wood', desktop: { x: 1400, y: 120, w: 170, h: 222, pad: 12, inner: 0 } },
  { slug: 'homer-the-water-fan', kind: 'paper', desktop: { x: 1405, y: 410, w: 200, h: 139, pad: 7, inner: 14 } },
  { slug: 'monet-cliff-walk-at-pourville', kind: 'gilt', desktop: { x: 1110, y: 750, w: 200, h: 160, pad: 11, inner: 3 } },
  { slug: 'sargent-olive-trees-corfu', kind: 'paper', desktop: { x: 1400, y: 690, w: 200, h: 142, pad: 7, inner: 14 } },
];

// When today's painting is one of the hung works, a reserve takes its place.
export const RESERVES = ['sisley-a-turn-in-the-road', 'pissarro-haymaking-at-eragny', 'renoir-seascape', 'homer-coast-of-maine'];

// Today's painting: centred under the lamp, fitted into this box.
export const CENTER = {
  desktop: { cx: 792, y: 239, w: 420, h: 336, pad: 18, inner: 4 },
  mobile: { cx: 195, y: 136, w: 222, h: 178, pad: 11, inner: 3 },
};

export const WALL = { desktop: { w: 1440, h: 960 }, mobile: { w: 390, h: 520 } };
