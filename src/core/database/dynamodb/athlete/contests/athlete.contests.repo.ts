import { Injectable } from '@nestjs/common';
import { DDBRepository, LocalSecondaryIndexName } from '../../dynamodb.repo';
import { IDynamoDBService } from 'core/aws/aws.services.interface';
import { logThrowDynamoDBError } from '../../utils/utils';
import { AllAttrs, DDBAthleteContestItem } from './athlete.contests.interface';
import { LastEvaluatedKey } from '../../interfaces/table.interface';
import { Discipline } from 'shared/enums';
import { AttrsTransformer } from './transformers/attributes.transformer';

@Injectable()
export class DDBAthleteContestsRepository extends DDBRepository {
  protected _tableName = 'ISA-Rankings';
  private readonly transformer = new AttrsTransformer();

  constructor(dynamodbService: IDynamoDBService) {
    super(dynamodbService);
  }

  public async put(contest: DDBAthleteContestItem) {
    const params = {
      TableName: this._tableName,
      Item: this.transformer.transformItemToAttrs(contest),
    };
    return this.client
      .put(params)
      .promise()
      .then(data => data)
      .catch(logThrowDynamoDBError('DDBAthleteContestsRepository Put', params));
  }

  public async queryAthleteContestsByDate(
    athleteId: string,
    year: number,
    discipline: Discipline,
    limit: number,
    after?: {
      contestId: string;
      date: number;
    },
  ) {
    let startKey: LastEvaluatedKey;
    if (after && after.contestId && after.date) {
      startKey = {
        PK: this.transformer.itemToAttrsTransformer.PK(athleteId),
        SK_GSI: this.transformer.itemToAttrsTransformer.SK_GSI(
          year,
          discipline,
          after.contestId,
        ),
        LSI: this.transformer.itemToAttrsTransformer.LSI(
          year,
          discipline,
          after.date,
        ),
      };
    }
    const params: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: this._tableName,
      IndexName: LocalSecondaryIndexName,
      Limit: limit,
      ScanIndexForward: false,
      ExclusiveStartKey: startKey,
      KeyConditionExpression:
        '#pk = :pk and begins_with(#lsi, :sortKeyPrefix) ',
      ExpressionAttributeNames: {
        '#pk': this.transformer.attrName('PK'),
        '#lsi': this.transformer.attrName('LSI'),
      },
      ExpressionAttributeValues: {
        ':pk': this.transformer.itemToAttrsTransformer.PK(athleteId),
        ':sortKeyPrefix': this.transformer.itemToAttrsTransformer.LSI(
          year,
          discipline,
          undefined,
        ),
      },
    };
    return this.client
      .query(params)
      .promise()
      .then(data => {
        const items = data.Items.map((item: AllAttrs) => {
          return this.transformer.transformAttrsToItem(item);
        });
        return items;
      })
      .catch(
        logThrowDynamoDBError('DDBAthleteContestsRepository query', params),
      );
  }
}