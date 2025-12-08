import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { MODEL_NAMES } from '../../../shared/constants/model-names.constants';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, index: true })
  email: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.pre('deleteOne', async function (next) {
  const userId = this.getFilter()._id;
  if (userId) {
    const boardModel = this.model.collection.conn.model(MODEL_NAMES.BOARD);

    const ownedBoardCount = await boardModel.countDocuments({
      ownerId: userId,
    });
    if (ownedBoardCount > 0) {
      throw new Error(
        `Cannot delete user who owns ${ownedBoardCount} board(s).`,
      );
    }
  }
  next();
});

UserSchema.pre('findOneAndDelete', async function (next) {
  const userId = this.getFilter()._id;
  if (userId) {
    const boardModel = this.model.collection.conn.model(MODEL_NAMES.BOARD);

    const ownedBoardCount = await boardModel.countDocuments({
      ownerId: userId,
    });
    if (ownedBoardCount > 0) {
      throw new Error(
        `Cannot delete user who owns ${ownedBoardCount} board(s).`,
      );
    }
  }
  next();
});
