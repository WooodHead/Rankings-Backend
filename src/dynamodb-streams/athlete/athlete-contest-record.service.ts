import { Injectable } from '@nestjs/common';
import { DynamoDBRecord, StreamRecord } from 'aws-lambda';
import { AthleteRanking } from 'core/athlete/entity/athlete-ranking';
import { AthleteContestResult } from 'core/athlete/entity/contest-result';
import { DatabaseService } from 'core/database/database.service';
import { DDBAthleteContestsRepository } from 'core/database/dynamodb/athlete/contests/athlete.contests.repo';
import { isRecordOfTypeOfKeys } from 'dynamodb-streams/utils';
import { isNil } from 'lodash';
import { AgeCategory, Discipline, Gender } from 'shared/enums';
import { DisciplineUtility, EnumsUtility } from 'shared/enums-utility';
import { Utils } from 'shared/utils';

interface RankingCombination {
  discipline: Discipline;
  gender: Gender;
  ageCategory: AgeCategory;
}
@Injectable()
export class AthleteContestRecordService {
  constructor(
    private readonly db: DatabaseService,
    private readonly athleteContestsRepo: DDBAthleteContestsRepository,
  ) {}

  public isRecordValidForThisService(record: StreamRecord): boolean {
    const prefixes = this.athleteContestsRepo.transformer.prefixes;
    return isRecordOfTypeOfKeys(record.Keys, prefixes);
  }

  public async processNewRecord(record: DynamoDBRecord) {
    if (record.eventName === 'INSERT') {
      const item = this.athleteContestsRepo.transformFromDynamoDBType(record.dynamodb.NewImage);
      await this.processNewContestResult(item);
    }
    if (record.eventName === 'MODIFY') {
      const oldItem = this.athleteContestsRepo.transformFromDynamoDBType(record.dynamodb.OldImage);
      const newItem = this.athleteContestsRepo.transformFromDynamoDBType(record.dynamodb.NewImage);
      await this.processModifiedContestResult(oldItem, newItem);
    }
    if (record.eventName === 'REMOVE') {
      const oldItem = this.athleteContestsRepo.transformFromDynamoDBType(record.dynamodb.OldImage);
      await this.processRemovedContestResult(oldItem);
    }
  }

  private async processNewContestResult(newItem: AthleteContestResult) {
    const pointsToAdd = newItem.points;
    const year = Utils.unixToDate(newItem.contestDate).year();

    await this.updateRankingsForCombinations(newItem.athleteId, newItem.contestDiscipline, year, pointsToAdd);
  }

  private async processModifiedContestResult(oldItem: AthleteContestResult, newItem: AthleteContestResult) {
    const pointsToAdd = newItem.points - oldItem.points;
    if (pointsToAdd === 0) {
      return;
    }
    const year = Utils.unixToDate(newItem.contestDate).year();

    await this.updateRankingsForCombinations(newItem.athleteId, newItem.contestDiscipline, year, pointsToAdd);
  }

  private async processRemovedContestResult(oldItem: AthleteContestResult) {
    const pointsToAdd = -oldItem.points;
    const year = Utils.unixToDate(oldItem.contestDate).year();

    await this.updateRankingsForCombinations(oldItem.athleteId, oldItem.contestDiscipline, year, pointsToAdd);
  }

  private async updateRankingsForCombinations(
    athleteId: string,
    discipline: Discipline,
    year: number,
    pointsToAdd: number,
  ) {
    const athlete = await this.db.getAthleteDetails(athleteId);
    if (!athlete) {
      return;
    }
    const combinations = this.generateAllCombinationsWithParentCategories(
      discipline,
      athlete.gender,
      athlete.ageCategory,
    );

    for (const combination of combinations) {
      const pk = {
        ageCategory: combination.ageCategory,
        athleteId: athlete.id,
        discipline: combination.discipline,
        gender: combination.gender,
        year: year,
      };
      const athleteRanking = await this.db.getAthleteRanking(pk);
      if (athleteRanking) {
        await this.db.updatePointsOfAthleteRanking(pk, pointsToAdd);
      } else {
        const item: AthleteRanking = {
          ageCategory: combination.ageCategory,
          country: athlete.country,
          discipline: combination.discipline,
          gender: combination.gender,
          id: athlete.id,
          name: athlete.name,
          points: pointsToAdd,
          surname: athlete.surname,
          year: year,
        };
        await this.db.putAthleteRanking(item);
      }
    }
  }
  private generateAllCombinationsWithParentCategories(
    discipline: Discipline,
    gender: Gender,
    ageCategory: AgeCategory,
  ) {
    const allDisciplines = [discipline, ...DisciplineUtility.getParentDisciplines(discipline)];
    const allGenders = [gender, ...EnumsUtility.getParentGenders(gender)];
    const allAgeCategories = [ageCategory, ...EnumsUtility.getParentAgeCategory(ageCategory)];

    const combinations: RankingCombination[] = [];
    for (const d of allDisciplines) {
      for (const g of allGenders) {
        for (const a of allAgeCategories) {
          if (!isNil(d) && !isNil(g) && !isNil(a)) {
            combinations.push({ discipline: d, gender: g, ageCategory: a });
          }
        }
      }
    }
    return combinations;
  }
}
