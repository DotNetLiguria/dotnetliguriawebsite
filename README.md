# dotnetliguriawebsite
The DotNetLiguria website source code (ASP.NET Core)

## Notes

The `docker-compose.yaml` file pulls and generates the image needed to run MongoDB in container

From this folder run (it will run and stay

```
docker-compose up -d
```

After this, you can start the container from Docker desktop directly.

## backup/restore

```
mongodump -u<mongodbUsername> -p<mongodbPassword> --archive=/tmp/backup.gz --gzip --db <mongodbDatabase>
unzip the backup copied
	cd \tmp
	tar xzfv backup.gz

Restore the database (dump is the folder with the unzipped data):
	mongorestore --verbose -u root -p <password> --nsInclude="*" /tmp/dump/
```

## Client tools
[Windows download](https://www.mongodb.com/try/download/compass)

[Ubuntu download](https://www.digitalocean.com/community/tutorials/how-to-install-mongodb-on-ubuntu-20-04)
