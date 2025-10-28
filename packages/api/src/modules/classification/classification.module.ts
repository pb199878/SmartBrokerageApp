import { Module } from '@nestjs/common';
import { ClassificationService } from './classification.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ClassificationService],
  exports: [ClassificationService], // Export so other modules can use it
})
export class ClassificationModule {}

