import badmintonImg from '~/assets/images/sports/badminton.jpg';
import basketballImg from '~/assets/images/sports/basketball.jpg';
import boxingImg from '~/assets/images/sports/boxing.jpg';
import footballImg from '~/assets/images/sports/football.jpg';
import gymImg from '~/assets/images/sports/gym.jpg';
import pickleballImg from '~/assets/images/sports/pickleball.jpg';
import swimImg from '~/assets/images/sports/swim.jpg';
import tennisImg from '~/assets/images/sports/tennis.jpg';
import yogaImg from '~/assets/images/sports/yoga.jpg';
import zumbaImg from '~/assets/images/sports/zumba.jpg';

export type VenueType = 'COURT' | 'ROOM';

export type SportCardSize = 'big' | 'wide' | 'tall';

export interface LandingSport {
  id: string;
  name: string;
  description: string;
  image: string;
  venue: {
    type: VenueType;
    count: number;
    minHourlyRate?: number;
  };
  openClasses: number;
  coaches: number;
  cardSize?: SportCardSize;
}

// TODO: replace with API data once the backend is ready (keep the LandingSport shape)
export const SPORTS: LandingSport[] = [
  {
    id: 'gym',
    name: 'Gym',
    description: 'Thể hình với máy và tạ tự do',
    image: gymImg,
    venue: { type: 'ROOM', count: 1 },
    openClasses: 1,
    coaches: 2,
    cardSize: 'big',
  },
  {
    id: 'yoga',
    name: 'Yoga',
    description: 'Yoga, Pilates, thiền',
    image: yogaImg,
    venue: { type: 'ROOM', count: 1 },
    openClasses: 2,
    coaches: 1,
  },
  {
    id: 'boxing',
    name: 'Boxing',
    description: 'Quyền anh và Kickboxing',
    image: boxingImg,
    venue: { type: 'ROOM', count: 1 },
    openClasses: 1,
    coaches: 1,
  },
  {
    id: 'swim',
    name: 'Bơi lội',
    description: 'Bơi cơ bản, nâng cao, bơi trẻ em',
    image: swimImg,
    venue: { type: 'ROOM', count: 1 },
    openClasses: 1,
    coaches: 1,
    cardSize: 'wide',
  },
  {
    id: 'badminton',
    name: 'Cầu lông',
    description: 'Sân cầu lông tiêu chuẩn, lớp kỹ thuật',
    image: badmintonImg,
    venue: { type: 'COURT', count: 4, minHourlyRate: 100_000 },
    openClasses: 1,
    coaches: 1,
    cardSize: 'tall',
  },
  {
    id: 'tennis',
    name: 'Tennis',
    description: 'Sân cứng, lớp thiếu niên & người lớn',
    image: tennisImg,
    venue: { type: 'COURT', count: 2, minHourlyRate: 250_000 },
    openClasses: 1,
    coaches: 1,
  },
  {
    id: 'pickleball',
    name: 'Pickleball',
    description: 'Sân pickleball, đặt theo giờ',
    image: pickleballImg,
    venue: { type: 'COURT', count: 2, minHourlyRate: 150_000 },
    openClasses: 1,
    coaches: 1,
  },
  {
    id: 'basketball',
    name: 'Bóng rổ',
    description: 'Sân trong nhà, lớp trẻ em & giao lưu',
    image: basketballImg,
    venue: { type: 'COURT', count: 1, minHourlyRate: 300_000 },
    openClasses: 1,
    coaches: 1,
    cardSize: 'wide',
  },
  {
    id: 'zumba',
    name: 'Zumba',
    description: 'Nhảy Zumba, Aerobic đốt mỡ',
    image: zumbaImg,
    venue: { type: 'ROOM', count: 1 },
    openClasses: 1,
    coaches: 1,
  },
  {
    id: 'football',
    name: 'Bóng đá mini',
    description: 'Sân 5 người cỏ nhân tạo',
    image: footballImg,
    venue: { type: 'COURT', count: 1, minHourlyRate: 400_000 },
    openClasses: 0,
    coaches: 1,
  },
];

export const TOTAL_COURTS = SPORTS.filter((s) => s.venue.type === 'COURT').reduce((sum, s) => sum + s.venue.count, 0);

export const TOTAL_ROOMS = SPORTS.filter((s) => s.venue.type === 'ROOM').reduce((sum, s) => sum + s.venue.count, 0);

export const MIN_COURT_RATE = Math.min(...SPORTS.map((s) => s.venue.minHourlyRate ?? Infinity));

export const TOTAL_COACHES = 6;
