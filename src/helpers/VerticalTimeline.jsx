import React from 'react';
import './PlanMediaWorkspace.css';
import { Film, Tv, Megaphone, Clock } from 'lucide-react';
export function VerticalTimeline({ events }) {

  const renderIcon = (type) => {
    const typeSaisi = type ? type.toLowerCase() : '';

    if (typeSaisi.includes('épisode') || typeSaisi.includes('episode')) {
      return <Film size={14} style={{ color: "rgb(36, 60, 84)" }} />;
    }
    if (typeSaisi.includes('programme')) {
      return <Tv size={14} className="text-blue-500" />;
    }
    if (typeSaisi.includes('publicité') || typeSaisi.includes('annonce') || typeSaisi.includes('spot')) {
      return <Megaphone size={14} style={{ color: "orange" }} />;
    }

    // Icône par défaut
    return <Clock size={14} className="text-slate-400" />;
  };
  const getTooltipStyle = (type) => {
    const typeSaisi = type ? type.toLowerCase() : '';

    if (typeSaisi.includes('épisode') || typeSaisi.includes('episode')) {
      return {
        backgroundColor: 'rgb(36, 60, 84)', // Bleu ardoise mat clair
        borderColor: '#ffffff',
        color: '#ffffff'
      };
    }
    if (typeSaisi.includes('programme')) {
      return {
        backgroundColor: 'rgb(36, 60, 84)', // Bleu nuit mat (Wet Asphalt)
        borderColor: '#3F51B5',
        color: '#f8fafc'
      };
    }
    if (typeSaisi.includes('publicité') || typeSaisi.includes('annonce') || typeSaisi.includes('spot')) {
      return {
        backgroundColor: 'rgb(36, 60, 84)', // Bleu-gris mat (Material Blue-Grey)
        borderColor: '#ffffff',
        color: 'rgb(255, 255, 255)'
      };
    }

    return {
      backgroundColor: '#475569', // Slate 600 de Tailwind (Neutre mat)
      borderColor: '#334155',
      color: '#f8fafc'
    };
  };
  const textGradientStyle = {

    color: 'orange',
    fontWeight: '200'
  };
  return (
    <div >
      {events.length === 0 ? (
        <div className="pm-timeline-empty">
          <div className="pm-empty-icon">📺</div>
          <h3 style={{ color: "gray" }}>Aucune diffusion ou annonce aujourd'hui</h3>
          <p>Il n'y a aucun événement programmé pour cette date.</p>
        </div>) : (

        <div className="pm-timeline">
          {
            events.map((event, index) => {
              const eventType = (event.details?.type || event.type || "").toLowerCase();

              // 2. Vérification robuste (gère majuscules/minuscules et corrige la faute)
              const isProgramme = eventType.includes('épisode') ||
                eventType.includes('episode') ||
                eventType.includes('programme');

              return (
                <div
                  key={event.id || index}
                  className="pm-timeline-event"
                  tabIndex={0}
                  aria-describedby={`tooltip-${event.id || index}`}
                >
                  <div
                    className="pm-timeline-icon-wrapper flex items-center justify-center border border-slate-100 rounded-full w-7 h-7 z-10 shadow-sm shrink-0 mt-0.5"
                    style={{
                      backgroundColor: isProgramme ?  "orange": "#243c54",
                      // Petite astuce : on force la couleur de l'icône en blanc si le fond est bleu marine
                    }}
                  >
                    {renderIcon(eventType)}
                  </div>

                  <div className="pm-timeline-content ml-3">
                    <span className="pm-timeline-time">{event.time}{" "}{event.date_tri}</span>
                    <span className="pm-timeline-name">{event.name}</span>
                  </div>

                  {/* Application du style dynamique sur le wrapper du tooltip */}
                  <div
                    id={`tooltip-${event.id || index}`}
                    className="pm-timeline-tooltip"
                    role="tooltip"
                    style={getTooltipStyle(eventType)}
                  >
                    <div className="pm-tooltip-header" style={{ borderBottomColor: 'rgba(255,255,255,0.1)' }}>
                      {/* Application du dégradé de texte blanc sur le titre */}
                      <h4 className="pm-tooltip-title" style={textGradientStyle}>{event.name}</h4>
                      <p className="pm-tooltip-subtitle" style={{ color: '#cbd5e1' }}>{event.time}</p>
                    </div>

                    {event.details ? (
                      <div className="pm-tooltip-body" style={{ color: '#e2e8f0' }}>
                        {event.details.type && (
                          <p className="pm-tooltip-row">
                            <span className="pm-tooltip-label" style={{ color: '#ffffff' }}>Type :</span> {event.details.type}
                          </p>
                        )}
                        {event.details.programme && (
                          <p className="pm-tooltip-row">
                            <span className="pm-tooltip-label" style={{ color: '#ffffff' }}>Programme :</span> {event.details.programme}
                          </p>
                        )}
                        {event.details.duree && (
                          <p className="pm-tooltip-row">
                            <span className="pm-tooltip-label" style={{ color: '#ffffff' }}>Durée :</span> {event.details.duree}
                          </p>
                        )}

                      </div>
                    ) : (
                      <p className="pm-tooltip-empty" style={{ color: '#ffffff' }}>Aucun détail supplémentaire.</p>
                    )}
                  </div>
                </div>
              );
            })
          }
        </div>

      )}


    </div>
  );
}