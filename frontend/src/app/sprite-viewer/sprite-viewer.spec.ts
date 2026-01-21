import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SpriteViewer } from './sprite-viewer';

describe('SpriteViewer', () => {
  let component: SpriteViewer;
  let fixture: ComponentFixture<SpriteViewer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SpriteViewer]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SpriteViewer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
