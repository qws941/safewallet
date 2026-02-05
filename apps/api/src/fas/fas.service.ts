import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/services/crypto.service';
import { FasWorkerDto, SyncWorkersDto } from './dto';

@Injectable()
export class FasService {
  private readonly logger = new Logger(FasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {}

  async syncWorkers(dto: SyncWorkersDto) {
    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as { externalWorkerId: string; error: string }[],
    };

    for (const worker of dto.workers) {
      try {
        await this.upsertWorker(worker);
        const existing = await this.prisma.user.findFirst({
          where: { externalWorkerId: worker.externalWorkerId },
        });
        if (existing) {
          results.updated++;
        } else {
          results.created++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          externalWorkerId: worker.externalWorkerId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        this.logger.error(`Failed to sync worker ${worker.externalWorkerId}`, error);
      }
    }

    return results;
  }

  async upsertWorker(worker: FasWorkerDto) {
    const normalizedPhone = worker.phone.replace(/[^0-9]/g, '');
    const phoneHash = this.cryptoService.hmac(normalizedPhone);
    const dobHash = this.cryptoService.hmac(worker.dob);

    const nameMasked = this.maskName(worker.name);

    const existing = await this.prisma.user.findFirst({
      where: { externalWorkerId: worker.externalWorkerId },
    });

    if (existing) {
      return this.prisma.user.update({
        where: { id: existing.id },
        data: {
          name: worker.name,
          nameMasked,
          phone: normalizedPhone,
          phoneHash,
          dob: worker.dob,
          dobHash,
          companyName: worker.companyName,
          tradeType: worker.tradeType,
        },
      });
    }

    return this.prisma.user.create({
      data: {
        externalSystem: 'FAS',
        externalWorkerId: worker.externalWorkerId,
        name: worker.name,
        nameMasked,
        phone: normalizedPhone,
        phoneHash,
        dob: worker.dob,
        dobHash,
        companyName: worker.companyName,
        tradeType: worker.tradeType,
        role: 'WORKER',
      },
    });
  }

  private maskName(name: string): string {
    if (name.length <= 1) return '*';
    if (name.length === 2) return name[0] + '*';
    return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
  }

  async deleteWorker(externalWorkerId: string) {
    const user = await this.prisma.user.findFirst({
      where: { externalWorkerId },
    });

    if (!user) {
      return { deleted: false, reason: 'User not found' };
    }

    await this.prisma.user.delete({ where: { id: user.id } });
    return { deleted: true };
  }
}
