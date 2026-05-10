import { BaseRepository } from './base.repository';
import { InternalServerException } from '../../common/exceptions';

class TestRepo extends BaseRepository {
  // BaseRepository requires `db` to be supplied via @InjectDb in real subclasses.
  // The paginate path doesn't touch `this.db`, so an empty stub is fine.
  constructor() {
    super({} as never);
  }

  // Expose protected paginate() for unit testing.
  callPaginate<T>(
    dataPromise: Promise<T[]>,
    countFactory: () => Promise<{ total: number }[]>,
    page: number,
    pageSize: number,
  ) {
    return this.paginate(dataPromise, countFactory, page, pageSize);
  }
}

describe('BaseRepository.paginate', () => {
  let repo: TestRepo;

  beforeEach(() => {
    repo = new TestRepo();
  });

  it('returns the correct total on page 1 when result set fits in one page (no count query)', async () => {
    // Page 1, page size 10, only 7 rows in the entire table → total is 7.
    const rows = Array.from({ length: 7 }, (_, i) => ({ id: i + 1 }));
    const countFactory = jest.fn().mockResolvedValue([{ total: 999 }]); // wrong on purpose

    const result = await repo.callPaginate(Promise.resolve(rows), countFactory, 1, 10);

    expect(result.rows).toHaveLength(7);
    expect(result.total).toBe(7);
    // Fast path must NOT call the count factory.
    expect(countFactory).not.toHaveBeenCalled();
  });

  it('runs the count query on page 2 with partial results and returns the true total', async () => {
    // Page 2, page size 10, page 2 has 7 rows. True total is 17.
    // Previous implementation reported 17 only by coincidence (offset + length);
    // if a row had been deleted between page 1 and page 2 fetches, true total
    // could be 16. We assert the count factory's number is the source of truth.
    const rowsPage2 = Array.from({ length: 7 }, (_, i) => ({ id: i + 11 }));
    const countFactory = jest.fn().mockResolvedValue([{ total: 16 }]);

    const result = await repo.callPaginate(Promise.resolve(rowsPage2), countFactory, 2, 10);

    expect(result.rows).toHaveLength(7);
    expect(result.total).toBe(16);
    expect(countFactory).toHaveBeenCalledTimes(1);
  });

  it('runs the count query on page 1 when the page is full (we cannot tell if more pages exist)', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ id: i + 1 }));
    const countFactory = jest.fn().mockResolvedValue([{ total: 47 }]);

    const result = await repo.callPaginate(Promise.resolve(rows), countFactory, 1, 10);

    expect(result.total).toBe(47);
    expect(countFactory).toHaveBeenCalledTimes(1);
  });

  it('runs the count query on page 2 with a full page', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ id: i + 11 }));
    const countFactory = jest.fn().mockResolvedValue([{ total: 47 }]);

    const result = await repo.callPaginate(Promise.resolve(rows), countFactory, 2, 10);

    expect(result.total).toBe(47);
    expect(countFactory).toHaveBeenCalledTimes(1);
  });

  it('returns total=0 on an empty page 1 without invoking the count factory', async () => {
    const countFactory = jest.fn();

    const result = await repo.callPaginate(Promise.resolve([]), countFactory, 1, 10);

    expect(result.rows).toEqual([]);
    expect(result.total).toBe(0);
    expect(countFactory).not.toHaveBeenCalled();
  });

  it('throws InternalServerException when the count factory returns an empty result', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ id: i + 1 }));
    const countFactory = jest.fn().mockResolvedValue([]);

    await expect(
      repo.callPaginate(Promise.resolve(rows), countFactory, 1, 10),
    ).rejects.toBeInstanceOf(InternalServerException);
  });
});
