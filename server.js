const { ApolloServer, gql } = require('apollo-server-express');
const express = require('express');
const { createServer } = require('http');
const { SubscriptionServer } = require('subscriptions-transport-ws');
const { execute, subscribe } = require('graphql');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { PrismaClient } = require('@prisma/client');
const { PubSub } = require('graphql-subscriptions');

const prisma = new PrismaClient();
const pubsub = new PubSub();
const MESSAGE_ADDED = 'MESSAGE_ADDED';
const MESSAGE_DELETED= 'MESSAGE_DELETED';
const MESSAGE_UPDATED= 'MESSAGE_UPDATED';

const typeDefs = gql`

  type Message {
    id: ID!
    user: String!
    content: String!
    parentId: ID
    createdAt: String!
  }

  type Query {
    messages: [Message!]
  }

  type Mutation {
    postMessage(user: String!, content: String!, parentId:ID): Message!
    deleteMessage(id:ID!): Message!
    updateMessage(id:ID!, user: String!, content: String!): Message!
  }

  type Subscription {
    messageAdded: Message!
    messageDeleted: Message!
    messageUpdated: Message!
  }
`;

const resolvers = {
  Query: {
    messages: async () => {
      return await prisma.message.findMany();
    },
  },
  Mutation: {
    postMessage: async (parent, { user, content,parentId }) => {
      const message = await prisma.message.create({
        data: {
          user,
          content,
          parentId: parentId ? parseInt(parentId) : null
        },
      });
      pubsub.publish(MESSAGE_ADDED, { messageAdded: message });
      return message;
    },
    deleteMessage: async (parent,{id}) => {
      const message = await prisma.message.delete({
        where: {
          id:parseInt(id),
        }
      });
      pubsub.publish(MESSAGE_DELETED,{ messageDeleted: message})
      return message;
    },
    deleteMessage: async (parent,{id}) => {
      const message = await prisma.message.delete({
        where: {
          id:parseInt(id),
        }
      });
      pubsub.publish(MESSAGE_DELETED,{ messageDeleted: message})
      return message;
    },
    updateMessage: async (parent,{id,user,content}) => {
      const message = await prisma.message.update({
        where: {
          id:parseInt(id)
        },
          data:{user,content}
      });
      pubsub.publish(MESSAGE_UPDATED,{ messageUpdated: message})
      return message;
    }
  },
  Subscription: {
    messageAdded: {
      subscribe: () => pubsub.asyncIterator([MESSAGE_ADDED]),
    },
    messageDeleted: {
      subscribe: () => pubsub.asyncIterator([MESSAGE_DELETED]),
    },
    messageUpdated: {
      subscribe: () => pubsub.asyncIterator([MESSAGE_UPDATED])
    }
  },
};

const schema = makeExecutableSchema({ typeDefs, resolvers });

const app = express();
const httpServer = createServer(app);

const server = new ApolloServer({ schema });

async function startApolloServer() {
  await server.start();
  server.applyMiddleware({ app });
}

startApolloServer().then(() => {
  httpServer.listen({ port: 4000 }, () => {
    console.log(`🚀 HTTP Server ready at http://localhost:4000${server.graphqlPath}`);
  });

  // Create Subscription Server
  new SubscriptionServer(
    {
      execute,
      subscribe,
      schema,
    },
    {
      server: httpServer,
      path: '/subscriptions',
    }
  );

  console.log(`🚀 Subscriptions ready at ws://localhost:4000/subscriptions`);
});
