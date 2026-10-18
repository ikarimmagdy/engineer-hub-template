# Engineering Hub comments API

A tiny serverless backend so the team's comments persist, are shared across everyone,
and are readable by Claude. Until this is deployed, the widget runs in **local demo
mode** (comments saved only in each viewer's browser).

**Stack:** AWS HTTP API Gateway, one Lambda (`handler.mjs`, Node 20), one DynamoDB
table (`engineer-hub-comments`). Pay-per-request, costs ~nothing at this volume.

## Deploy (AWS SAM)

Prereqs: AWS CLI logged in, and [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html).

```bash
cd outputs/engineer-guide/backend/comments
sam build
sam deploy --guided \
  --stack-name engineer-hub-comments \
  --region us-east-2 \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides AllowOrigin=https://your-hub.example.com
```

SAM prints an **ApiUrl** output, for example
`https://abc123.execute-api.us-east-2.amazonaws.com/comments`.

## Point the hub at it

Edit `outputs/engineer-guide/content/comments-config.json`:

```json
{ "enabled": true, "apiUrl": "https://abc123.execute-api.us-east-2.amazonaws.com/comments", "reviewerPasscode": "changeme" }
```

Re-sync the hub to S3. The widget now reads and writes shared comments. (Set
`AllowOrigin` to the hub's real origin so only it can call the API.)

## How the team uses it

- Anyone opens a page and clicks the comment button (bottom right) to read or leave a
  comment on that page. A page can be shared with its comments open via
  `…index.html?comments=open#/feature/p7`.
- **Reviewer mode** (tick the box, enter `reviewerPasscode`) adds **Accept**,
  **Resolve** and **Reply** on each comment, so you can triage and respond.

## How Claude reads the comments

Two ways, both work for me in a session with AWS access:

```bash
# everything, newest activity included
aws dynamodb scan --table-name engineer-hub-comments --region us-east-2

# or over HTTP (all, or one page)
curl "https://abc123.execute-api.us-east-2.amazonaws.com/comments"
curl "https://abc123.execute-api.us-east-2.amazonaws.com/comments?page=%23/feature/p7"
```

Paste either output to me and I will read the comments, propose changes, and (if you
want) reply or mark them accepted/resolved via the same API.

## API shape

| Method | Path | Body | Does |
|---|---|---|---|
| GET | `/comments?page=<route>` | — | list comments for a page |
| GET | `/comments` | — | list all (export / review) |
| POST | `/comments` | `{page, author, text}` | add a comment |
| PATCH | `/comments/{id}` | `{status}` or `{reply:{author,text}}` | accept / resolve / reply |

`status` is one of `open`, `accepted`, `resolved`.

## Notes

- For separate demo / dev / prod hubs, deploy one stack per environment (or one table
  with the environment in the `page` key) so comments do not mix.
- This is comment data only, no auth beyond the reviewer passcode. Do not put secrets
  in comments. Add Cognito or a shared API key in front of writes if you need more.
