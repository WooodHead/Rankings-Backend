import * as Joi from 'joi';

import { CompetitionDisciplines } from 'shared/enums';
import { APIErrors } from 'shared/exceptions/api.exceptions';

export class SubmitContestPictureDto {
  public readonly url: string;
  public readonly id: string;
  public readonly discipline: number;
}

export const submitContestPictureDtoSchema = Joi.object().keys({
  id: Joi.string()
    .required()
    .error(new APIErrors.JoiValidationError('Unknown id')),
  discipline: Joi.number()
    .required()
    .valid(CompetitionDisciplines)
    .error(new APIErrors.JoiValidationError('Invalid discipline')),
  url: Joi.string()
    .uri()
    .error(new APIErrors.JoiValidationError('Unknown url')),
});
