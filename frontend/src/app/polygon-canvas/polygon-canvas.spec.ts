import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PolygonCanvas } from './polygon-canvas';

describe('PolygonCanvas', () => {
  let component: PolygonCanvas;
  let fixture: ComponentFixture<PolygonCanvas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PolygonCanvas]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PolygonCanvas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
