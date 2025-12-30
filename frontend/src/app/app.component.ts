import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  standalone: false,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'GenAnn Java Port';
  status = 'Idle';
  mode: 'default' | 'custom' = 'default'; // Track current mode
  
  imageIndices = Array.from({length: 10}, (_, i) => i + 1);
  timestamp = Date.now();

  constructor(private http: HttpClient) {}

  // 1. Standard Arc Training
  startTraining() {
    this.mode = 'default';
    this.status = 'Training Default Arcs...';
    this.http.post('http://localhost:8080/api/train', {}, { responseType: 'text' })
      .subscribe(this.handleResponse());
  }

  // 2. Custom Polygon Training (Called by Polygon Component)
  handlePolygonData(points: any[]) {
    this.mode = 'custom';
    this.status = 'Training Custom Polygon...';
    
    this.http.post('http://localhost:8080/api/points', points, { responseType: 'text' })
      .subscribe(this.handleResponse());
  }

  // Helper for response handling
  handleResponse() {
    return {
      next: (res: string) => {
        this.status = res;
        this.refreshImages();
      },
      error: (err: any) => {
        console.error(err);
        this.status = 'Error: ' + err.message;
      }
    };
  }

  refreshImages() {
    // Wait a bit or rely on manual refresh, or poll
    // Here we just update timestamp to force reload if images exist
    setTimeout(() => this.timestamp = Date.now(), 2000); 
  }

  pad(num: number): string {
    return num.toString().padStart(3, '0');
  }

  // Helper to build URL based on mode
  getImageUrl(type: 'output' | 'evolution', i: number): string {
    const folder = this.mode === 'custom' ? 'custom' : 'images';
    const ext = type === 'output' ? 'png' : 'gif';
    return `http://localhost:8080/${folder}/${type}_${this.pad(i)}.${ext}?t=${this.timestamp}`;
  }
}