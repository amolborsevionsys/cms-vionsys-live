import {
  Award,
  BarChart3,
  FileDown,
  GalleryHorizontalEnd,
  Heading,
  HelpCircle,
  Image as ImageIcon,
  ListOrdered,
  Megaphone,
  Minus,
  Quote,
  Table2,
  Target,
  Type,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { BlockType } from '@/features/case-studies/layout/layout.types';

export interface BlockMeta {
  label: string;
  description: string;
  icon: LucideIcon;
}

export const BLOCK_META: Record<BlockType, BlockMeta> = {
  // Case-study sections (bound to the case study's fields; once per page)
  hero: { label: 'Hero', description: 'Title, client, industry, summary and hero image', icon: Award },
  metrics: { label: 'Results metrics', description: 'Key numbers that prove the outcome', icon: BarChart3 },
  challenge: { label: 'Challenge', description: 'The problem the client faced', icon: Target },
  approach: { label: 'Approach', description: 'How the problem was solved', icon: Wrench },
  process: { label: 'Process steps', description: 'Numbered delivery timeline', icon: ListOrdered },
  gallery: { label: 'Gallery', description: 'A grid of project images', icon: GalleryHorizontalEnd },
  testimonial: { label: 'Testimonial', description: 'A quote from the client', icon: Quote },
  faq: { label: 'FAQ', description: 'Questions and answers', icon: HelpCircle },
  cta: { label: 'Call to action', description: 'Closing message with a button', icon: Megaphone },

  // Content blocks (free; any number)
  heading: { label: 'Heading', description: 'A section title', icon: Heading },
  text: { label: 'Text', description: 'Rich text with lists, links and formatting', icon: Type },
  image: { label: 'Image', description: 'One image with alt text and caption', icon: ImageIcon },
  table: { label: 'Table', description: 'Rows and columns of data', icon: Table2 },
  file: { label: 'File download', description: 'A link to a PDF or other file', icon: FileDown },
  divider: { label: 'Divider', description: 'A horizontal line between sections', icon: Minus },
};
