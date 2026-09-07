import React from 'react';
import './PlanMediaWorkspace.css';

export function VerticalTimeline({ events }) {
  return (
    <div className="pm-timeline">
      {events.map((event, index) => (
        <div 
          key={event.id || index} 
          className="pm-timeline-event" 
          tabIndex={0} 
          aria-describedby={`tooltip-${event.id || index}`}
        >
          <span className="pm-timeline-node" />
          
          <div className="pm-timeline-content">
            <span className="pm-timeline-time">{event.time}</span>
            <span className="pm-timeline-name">{event.name}</span>
          </div>

          {/* Tooltip qui s'affiche proprement en dessous au survol sans découpage */}
          <div 
            id={`tooltip-${event.id || index}`} 
            className="pm-timeline-tooltip" 
            role="tooltip"
          >
            <div className="pm-tooltip-header">
              <h4 className="pm-tooltip-title">{event.name}</h4>
              <p className="pm-tooltip-subtitle">{event.time}</p>
            </div>
            {event.details ? (
              <div className="pm-tooltip-body">
                {event.details.type && (
                  <p className="pm-tooltip-row">
                    <span className="pm-tooltip-label">Type :</span> {event.details.type}
                  </p>
                )}
                {event.details.duree && (
                  <p className="pm-tooltip-row">
                    <span className="pm-tooltip-label">Durée :</span> {event.details.duree}
                  </p>
                )}
                {event.details.description && (
                  <p className="pm-tooltip-row pm-tooltip-desc">{event.details.description}</p>
                )}
              </div>
            ) : (
              <p className="pm-tooltip-empty">Aucun détail supplémentaire.</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}