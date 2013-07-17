Hero.js
=======

##What is?

Hero is a library that give supports to a methodology, is not a framework, Hero works well with any NodeJS framework as Express, Hapi, Connect or any other.

Hero allows direct connection with MongoDB and Redis databases and with the queue management system RabbitMQ and ZeroMQ, but you can connect with any other database and queue management system coding your own DTO (Data Transfer Object) or QTO (Queue Transfer Object).


##What are the pieces?

Hero provides 4 different architectural pieces to simplify and organize the relationships between the code.

####DTO (Data Transfer Object)

Provides abstraction about the asynchronous start connection pooling. Helps to organize the access through methods and specify a concrete collections, tables or hashes.


####QTO (Queue Transfer Object)

Provides abstraction about the asynchronous start connections.


####Worker

Provides abstraction about the interconnection with the rest of pieces including other Workers, this is the place where the business logic must be.


####End-point

Provides abstraction about the publish interfaces to provide http/s services.



<img src='./img/hero-architecture-v0.1.png'>

