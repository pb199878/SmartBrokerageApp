import { Module } from "@nestjs/common";
import { DropboxSignService } from "./dropbox-sign.service";

@Module({
  providers: [DropboxSignService],
  exports: [DropboxSignService],
})
export class DropboxSignModule {}

