export type StaticArchiveMediaType = 'photo' | 'video'
export type StaticArchiveOrientation = 'portrait' | 'landscape'

export interface StaticArchiveMedia {
  id: string
  type: StaticArchiveMediaType
  src: string
  poster?: string
  filename: string
  alt: string
  orientation: StaticArchiveOrientation
}

const photoFiles = [
  'IMG-20260817-WA0000.jpg',
  'IMG-20260817-WA0001.jpg',
  'IMG-20260817-WA0002.jpg',
  'IMG-20260817-WA0003.jpg',
  'IMG-20260817-WA0004.jpg',
  'IMG-20260817-WA0005.jpg',
  'IMG-20260817-WA0006.jpg',
  'IMG-20260817-WA0007.jpg',
  'IMG-20260817-WA0008.jpg',
  'IMG-20260817-WA0009.jpg',
  'IMG-20260817-WA0010.jpg',
  'IMG-20260817-WA0011.jpg',
  'IMG-20260817-WA0012.jpg',
  'IMG-20260817-WA0013.jpg',
  'IMG-20260817-WA0014.jpg',
  'IMG-20260817-WA0015.jpg',
  'IMG-20260817-WA0016.jpg',
  'IMG-20260817-WA0017.jpg',
  'IMG-20260817-WA0018.jpg',
  'IMG-20260817-WA0019.jpg',
  'IMG-20260817-WA0020.jpg',
  'IMG-20260817-WA0021.jpg',
  'IMG-20260817-WA0022.jpg',
  'IMG-20260817-WA0023.jpg',
  'IMG-20260817-WA0024.jpg',
  'IMG-20260817-WA0025.jpg',
  'IMG-20260817-WA0026.jpg',
  'IMG-20260817-WA0027.jpg',
  'IMG-20260817-WA0028.jpg',
  'IMG-20260817-WA0029.jpg',
  'IMG-20260817-WA0030.jpg',
  'IMG-20260817-WA0031.jpg',
  'IMG-20260817-WA0032.jpg',
] as const

const videoFiles = [
  'VID-20260817-WA0033.mp4',
  'VID-20260817-WA0034.mp4',
  'VID-20260817-WA0035.mp4',
  'VID-20260817-WA0036.mp4',
  'VID-20260817-WA0037.mp4',
  'VID-20260817-WA0038.mp4',
  'VID-20260817-WA0039.mp4',
  'VID-20260817-WA0040.mp4',
  'VID-20260817-WA0041.mp4',
  'VID-20260817-WA0042.mp4',
  'VID-20260817-WA0043.mp4',
  'VID-20260817-WA0044.mp4',
  'VID-20260817-WA0045.mp4',
  'VID-20260817-WA0046.mp4',
  'VID-20260817-WA0047.mp4',
  'VID-20260817-WA0048.mp4',
  'VID-20260817-WA0049.mp4',
  'VID-20260817-WA0050.mp4',
  'VID-20260817-WA0051.mp4',
  'VID-20260817-WA0052.mp4',
  'VID-20260817-WA0053.mp4',
  'VID-20260817-WA0054.mp4',
  'VID-20260817-WA0055.mp4',
  'VID-20260817-WA0056.mp4',
  'VID-20260817-WA0057.mp4',
  'VID-20260817-WA0058.mp4',
  'VID-20260817-WA0059.mp4',
  'VID-20260817-WA0061.mp4',
  'VID-20260817-WA0062.mp4',
  'VID-20260817-WA0063.mp4',
  'VID-20260817-WA0064.mp4',
  'VID-20260817-WA0065.mp4',
  'VID-20260817-WA0066.mp4',
  'VID-20260817-WA0067.mp4',
  'VID-20260817-WA0068.mp4',
] as const

const landscapePhotoNumbers = new Set([2, 6, 13, 16, 21])
const portraitVideoNumbers = new Set([34, 55])
const archiveRoot = '/assets/images'

const archiveNumber = (filename: string): number => Number(filename.match(/WA(\d{4})/)?.[1] ?? 0)

export const staticArchivePhotos: StaticArchiveMedia[] = photoFiles.map((filename) => {
  const number = archiveNumber(filename)
  return {
    id: `photo-${number}`,
    type: 'photo',
    src: `${archiveRoot}/${filename}`,
    filename,
    alt: 'A shared relationship photograph',
    orientation: landscapePhotoNumbers.has(number) ? 'landscape' : 'portrait',
  }
})

export const staticArchiveVideos: StaticArchiveMedia[] = videoFiles.map((filename) => {
  const number = archiveNumber(filename)
  return {
    id: `video-${number}`,
    type: 'video',
    src: `${archiveRoot}/${filename}`,
    poster: `${archiveRoot}/video-posters/${filename.replace('.mp4', '.webp')}`,
    filename,
    alt: 'A shared relationship film',
    orientation: portraitVideoNumbers.has(number) ? 'portrait' : 'landscape',
  }
})

export const staticArchiveMedia: StaticArchiveMedia[] = [...staticArchivePhotos, ...staticArchiveVideos]
