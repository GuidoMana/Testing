import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GlobalStatusService } from '../../services/global-status.service';

@Component({
  selector: 'app-template',
  imports: [RouterOutlet],
  templateUrl: './template.component.html',
  styleUrl: './template.component.css',
})
export class TemplateComponent {
  constructor(private globalStatusService: GlobalStatusService) {}

  isLoading(): boolean {
    return this.globalStatusService.isLoading();
  }
}
