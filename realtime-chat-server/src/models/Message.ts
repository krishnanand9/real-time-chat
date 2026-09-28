import { Schema, model, type InferSchemaType } from "mongoose";

const messageSchema = new Schema(
  {
    roomId: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    senderId: {
      type: String,
      required: true,
      trim: true
    },
    senderName: {
      type: String,
      required: true,
      trim: true
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    deliveredTo: {
      type: [String],
      default: []
    },
    readBy: {
      type: [String],
      default: []
    }
  },
  { timestamps: true }
);

messageSchema.index({ roomId: 1, createdAt: 1 });

export type MessageDocument = InferSchemaType<typeof messageSchema>;
export const Message = model("Message", messageSchema);
