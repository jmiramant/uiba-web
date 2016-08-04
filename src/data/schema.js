'use strict';
import {
  GraphQLSchema as Schema,
  GraphQLObjectType as ObjectType,
} from 'graphql';
import mongoose from 'mongoose';

import me from './queries/me';
import content from './queries/content';
import news from './queries/news';

const schema = new Schema({
  query: new ObjectType({
    name: 'Query',
    fields: {
      me,
      content,
      news,
    },
  }),
});

export default schema;
