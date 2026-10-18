/* ============================================================
   Engineering Hub comments API (AWS Lambda, Node 20).
   Routes (HTTP API):
     GET    /comments?page=<route>   -> list comments for a page
     GET    /comments                -> list ALL (for review / export)
     POST   /comments {page,author,text}
     PATCH  /comments/{id} {status?, reply?}
   Storage: one DynamoDB table, pk `id`, GSI `page-index` (page, ts).
   ============================================================ */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE;
const CORS = {
  'access-control-allow-origin': process.env.ALLOW_ORIGIN || '*',
  'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
  'access-control-allow-headers': 'content-type',
  'content-type': 'application/json'
};
const ok = body => ({ statusCode: 200, headers: CORS, body: JSON.stringify(body) });
const bad = (code, msg) => ({ statusCode: code, headers: CORS, body: JSON.stringify({ error: msg }) });
const clean = s => String(s || '').slice(0, 4000);

export const handler = async (event) => {
  const method = event.requestContext?.http?.method || 'GET';
  const path = event.requestContext?.http?.path || event.rawPath || '/comments';
  if (method === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  try {
    if (method === 'GET') {
      const page = event.queryStringParameters?.page;
      if (page) {
        const r = await ddb.send(new QueryCommand({
          TableName: TABLE, IndexName: 'page-index',
          KeyConditionExpression: '#p = :p', ExpressionAttributeNames: { '#p': 'page' },
          ExpressionAttributeValues: { ':p': page }, ScanIndexForward: true
        }));
        return ok(r.Items || []);
      }
      const r = await ddb.send(new ScanCommand({ TableName: TABLE }));
      return ok((r.Items || []).sort((a, b) => (a.ts > b.ts ? 1 : -1)));
    }

    if (method === 'POST') {
      const b = JSON.parse(event.body || '{}');
      if (!b.page || !b.author || !b.text) return bad(400, 'page, author and text are required');
      const item = {
        id: 'c' + Date.now() + Math.random().toString(36).slice(2, 7),
        page: clean(b.page), author: clean(b.author).slice(0, 80),
        text: clean(b.text), status: 'open', replies: [], ts: new Date().toISOString()
      };
      await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
      return ok(item);
    }

    if (method === 'PATCH') {
      const id = path.split('/').pop();
      const b = JSON.parse(event.body || '{}');
      if (!id) return bad(400, 'missing id');
      const sets = [], names = {}, values = {};
      if (b.status && ['open', 'accepted', 'resolved'].includes(b.status)) { sets.push('#s = :s'); names['#s'] = 'status'; values[':s'] = b.status; }
      if (b.reply && b.reply.text) {
        const reply = { author: clean(b.reply.author || 'Reviewer').slice(0, 80), text: clean(b.reply.text), ts: new Date().toISOString() };
        sets.push('#r = list_append(if_not_exists(#r, :empty), :reply)');
        names['#r'] = 'replies'; values[':reply'] = [reply]; values[':empty'] = [];
      }
      if (!sets.length) return bad(400, 'nothing to update');
      const r = await ddb.send(new UpdateCommand({
        TableName: TABLE, Key: { id }, UpdateExpression: 'SET ' + sets.join(', '),
        ExpressionAttributeNames: names, ExpressionAttributeValues: values, ReturnValues: 'ALL_NEW'
      }));
      return ok(r.Attributes || { ok: true });
    }

    return bad(405, 'method not allowed');
  } catch (e) {
    return bad(500, e.message);
  }
};
