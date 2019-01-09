import { ContestCategory, Discipline } from 'shared/enums';

export class Contest {
  public readonly id: string;
  public readonly name: string;
  public readonly date: Date;
  public readonly city: string;
  public readonly country: string;
  public readonly discipline: Discipline;
  public readonly contestCategory: ContestCategory;
  public readonly prize: number;
  public readonly profileUrl: string;
  public readonly thumbnailUrl: string;
  public readonly infoUrl: string;
  public readonly createdAt?: number;

  constructor(init: {
    id: string;
    name: string;
    date: Date;
    city: string;
    country: string;
    discipline: Discipline;
    contestCategory: ContestCategory;
    prize: number;
    profileUrl: string;
    thumbnailUrl: string;
    infoUrl: string;
    createdAt?: number;
  }) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
