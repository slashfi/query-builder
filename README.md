# Query builder

Refer to the [docs](docs/overview.md) for more information.

## Why? - A bit of history on query performance at Slash

Javascript is an ecosystem where server-side frameworks and libraries are fragmented -- it's probably this way because companies have been building enterprise applications in Node for way less time than in other languages. Additionally, as the language of the web, Javascript is truly a language built by an open community where anyone can contribute / build tooling to an unopinionated ecosystem. Today, Drizzle and Prisma are pretty standard defaults in the community and they are both pretty good. We don't use either of these because:

1. Prisma is a huge overhead change that we don't need. It has some cool application-side joining (for avoiding some of the issues we've had with server side joins), and does codegen for building strongly typed queries based off your schema. Hard migration to do, not the best fit for us.
2. Drizzle is a great query builder and does a lot of what we'd want. I felt like we can do better which is why we didn't adopt it. Building in-house let us do a better job around DX, type safety, and let's us progressively build more features that Drizzle might not support. As we updated our DB stack, we knew we needed to make sure we were backwards compatible with TypeORM and the level of control we could have if we were to build our own query builder was unparalleled.

For Slash, we started off using TypeORM at the beginning of 2021, when both Prisma and Drizzle didn't exist. TypeORM was great for getting started but over time, we found that ORMs weren't a great fit for us over time: 
- we couldn't write complex queries so we had to resort to raw SQL
- their migrations runner didn't support enough of our use cases
- mechanisms such as "save"-ing entities were too abstract and made unnecessary round trips to the database when developers in control knew they didn't need to do it.

Over the next few years, we started using raw queries more and more and shipped whatever worked and got things out the door. As growth continued, we realized that all these complex SQL queries that we could easily express in raw SQL were becoming performance bottlenecks. Queries that ran fine on tables with 100,000 rows blew up when there was 10x the data. We had full table scans left and right, and excessive joins were preventing us from optimizing query speeds.

Fast forward to December 2024, we had most complex queries in check. It turned out that denormalizing data (duplicating it) rather than joining, keeping queries simple were very effective in keeping our database performant. 

> The one thing common thread among every issue that we've ever had is: "scaling is stability's worst enemy". Anything that solved at 1x scale is probably going to break at 10x scale. This isn't a bad problem to have though. In fact, it's probably one of the best problems to have as a startup. Scaling means that we're growing, making more money, and we're solving more problems for more customers.

So in December 2024, as query performance was stabilizing but we were still scaling, we yet again had another query performance issue. We learned that it's very easy to shoot yourself in the foot with most SQL planners. SQL planners add in a form of indetermism into your application code that makes it nearly impossible to predict query performance. Since SQL planners take SQL statement and chooses a plan of execution to fetch data, it may choose a plan that's optimal in the average case or the optimal case, but not very bad in the worst case. Plans are generally based on table statistics and a sudden change in statistics when its recomputed can cause a query a query to take 10-100x longer than it did before. We call this ticking "time bombs" in our codebase.

Our solution to the ticking "time bombs" problem is that we need to make our queries completely deterministic. We can do this by explicitly telling the plan which indexes to use and how to join by using index hints and join hints. There's no reason why table names and columns are first-class citizens in most ORMs and query builders, but indexes are not. We can do better. Our query builder currently supports `selectFromIndex` in order to enforce the use of indexes and to ensure that while we write our SQL queries in the backend, we are always make sure we think about how SQL is accessing our data. The tradeoff we're making here is that changes to how we want to access our data requires changes to indexes and hints, but it should enforce better habits without sacrificing on DX and how fast we can ship features.


