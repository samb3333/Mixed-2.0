import { Schema, model, Document } from 'mongoose';

interface IExample extends Document {
	date: Date;
	number: number;
	array: string[];
}

const ExampleSchema = new Schema<IExample>({
	date: Date,
	number: Number,
	array: [String]
});

export default model<IExample>('Example', ExampleSchema);
