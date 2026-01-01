import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PuzzleSolver } from './puzzle-solver';

describe('PuzzleSolver', () => {
  let component: PuzzleSolver;
  let fixture: ComponentFixture<PuzzleSolver>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PuzzleSolver]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PuzzleSolver);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
